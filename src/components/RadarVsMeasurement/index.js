import React, { Component } from 'react';
import * as d3 from "d3";
import "./style.css"

const API_URL = "https://mdx.meteotest.ch/api_v1";
const API_KEY = "72B57D15D78F3865F8E2BE70BA291309";
const API_QUERY_DBKLIMA = "service=prod2data&action=probetag_montet_dbklima&format=json";
const API_QUERY_RADAR = "service=prod2data&action=probetag_montet_radar&format=json";


class RadarVsMeasurement extends Component {

    /**
     * This function aims at building
     * a query for the MDX Meteotest API
     *
     * @param url
     * @param key
     * @param query
     */
    queryBuilder(url, key, query) {
        return url
            + "?"
            + "key=" + key
            + "&" + query;
    }


    /**
     * A Generic method to fetch the data coming
     * from multiple webservices and aggregate
     * them in an array
     *
     * @params dataProcessing is a function that
     * knows how to process the fetched data to
     * clean it
     *
     * @params ...queries are the queries that are
     * meant to be fetched on the webservices
     *
     * @returns an Array with all the json response
     */
    dataFetcher(...queries){

        const requests = [];

        for (let i=0; i<queries.length; i++){
            requests.push(
                        fetch(queries[i])
                        .then(response => response.json())
                );
        }

        return requests
    }


    /**
     * Process a raw data in order to "clean" it.
     * Here the data preprocessing task is doing:
     *
     *  1. an extraction of the needed subfields
     *  2. a time range check between time series
     *  3. a interpolation of the longest timeserie to have a similar resolution
     *  4. a unit correction
     *
     * @param data
     *
     * @returns a dict of the data axis separately
     */
    dataProcessing(data) {

        // Put the values in arrays
        function arrayize(data, key) {
            let arr_x = [];
            let arr_y = [];
            Object.keys(data).forEach(function (k) {
                arr_x.push(new Date(k));
                arr_y.push(data[k][key]);
            });
            return {
                x: arr_x,
                y: arr_y
            }
        }

        // Interpolate an array
        // (taken from : https://stackoverflow.com/questions/26941168/javascript-interpolate-an-array-of-numbers)
        function interpolate(data, fitCount) {

            let linearInterpolate = function (before, after, atPoint) {
                return before + (after - before) * atPoint;
            };

            let newData = [];
            let springFactor = new Number((data.length - 1) / (fitCount - 1));
            newData[0] = data[0]; // for new allocation
            for ( let i = 1; i < fitCount - 1; i++) {
                let tmp = i * springFactor;
                let before = new Number(Math.floor(tmp)).toFixed();
                let after = new Number(Math.ceil(tmp)).toFixed();
                let atPoint = tmp - before;
                newData[i] = linearInterpolate(data[before], data[after], atPoint);
            }
            newData[fitCount - 1] = data[data.length - 1]; // for new allocation
            return newData;
        }

        // Get the needed sub-data in the measurement web-service
        let data_measurements = data[0]["payload"]["gridapi"]["interlaken"];
        let measurements = arrayize(data_measurements, 'prate');

        // Get the needed sub-data in the radar web-service
        let data_radar = data[1]["payload"]["dbklima"]["67340"];
        let radar = arrayize(data_radar, 'rr');

        // Check if the timestamp ranges are similar
        if (measurements.x[0].getTime() !== radar.x[0].getTime() ||
            measurements.x[measurements.x.length - 1].getTime() !== radar.x[radar.x.length - 1].getTime()) {
            throw new Error("The time range from the two time series are different");
        }

        // Interpolate the longest time serie
        if(measurements.y.length > radar.y.length){
            measurements.y = interpolate(measurements.y, radar.y.length);
        } else {
            radar.y = interpolate(radar.y, measurements.y.length);
        }

        // Correct the unit of the radar
        // TODO Ask for the unit of the two time series
        let tmp = [];
        radar.y.forEach(value => { tmp.push(value * 10)});
        radar.y = tmp;

        return {
            rdr_x : radar.x,
            rdr_y : radar.y,
            msr_x : measurements.x,
            msr_y : measurements.y
        }

    }


    /**
     * Plot a chart with two lines
     * and its difference in a sub-chart.
     *
     * @param data_x
     * @param data_y1
     * @param data_y2
     */
    plot(data_x, data_y1, data_y2){


        // ============ Data ============ //

        // Slight data change for plotting ease
        let data = [];
        for(let i=0;i<data_x.length;i++){
            data.push({"time": data_x[i],
                       "rdr": data_y1[i],
                       "msr": data_y2[i],
                       "diff": data_y1[i]-data_y2[i]
            });
        }

        // ============ Set Plot Areas ============ //

        // set the dimensions and margins of the graph for the 3 areas
        let margin = {top: 20, right: 20, bottom: 20, left: 20},
            width = 600 - margin.left - margin.right,
            height = 500 - margin.top - margin.bottom;

        let margin_lines = {top: 0, right: 0, bottom: 0, left: 0},
            width_lines = width - margin_lines.left - margin_lines.right,
            height_lines = (height/4) * 3 - margin_lines.top - margin_lines.bottom;

        let margin_diff = {top: 25, right: 0, bottom: 0, left: 0},
            width_diff = width - margin_diff.left - margin_diff.right,
            height_diff = (height/4) - margin_diff.top - margin_diff.bottom;

        // Create the main plotting area
        let svg = d3.select(".plot")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);

        // Create the line plot area
        let svg_lines = svg.append("g")
            .attr("width", width_lines)
            .attr("height", height_lines)
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

        // Create the difference plot area
        let svg_diff = svg.append("g")
            .attr("width", width_diff)
            .attr("height", height_diff)
            .attr("transform",
                "translate(" + margin.left + "," + (height_lines + margin.top + margin_diff.top) + ")");


        // ========== Line Plot =========== //

        // set the scales
        let x_lines = d3.scaleTime().range([0, width_lines]);
        let y_lines = d3.scaleLinear().range([height_lines, 0]);

        // grid lines in x axis function
        function make_x_gridlines() {
            return d3.axisBottom(x_lines)
                // TODO Get number of days between first and last day to get the nb of ticks
                .ticks(6)
        }

        // grid lines in y axis function
        function make_y_gridlines() {
            return d3.axisLeft(y_lines)
                .ticks(5)
        }

        // Make the line generator
        let line_rdr = d3.line()
            .x(function(d) { return x_lines(d.time) }) // set the x values for the line generator
            .y(function(d) { return y_lines(d.rdr) }); // set the y values for the line generator

        let line_msr = d3.line()
            .x(function(d) { return x_lines(d.time) }) // set the x values for the line generator
            .y(function(d) { return y_lines(d.msr) }); // set the y values for the line generator

        // Set the domain of the axis
        x_lines.domain(d3.extent(data, function(d) { return d.time }));
        y_lines.domain([0,d3.max(data, function(d){ return d.msr }) + 1]); // +1 to add a margin

        // set the axis
        let xAxis = d3.axisBottom(x_lines).ticks(6).tickFormat(d3.timeFormat("%a %d")).tickSizeOuter(0);
        let xAxisTop = d3.axisTop(x_lines).ticks(0).tickSizeOuter(0);
        let yAxis = d3.axisLeft(y_lines);
        let yAxisRight = d3.axisRight(y_lines).ticks(0).tickSizeOuter(0);

        // add the x grid lines
        svg_lines.append("g")
            .attr("class", "grid")
            .attr("transform", "translate(0," + height_lines + ")")
            .call(make_x_gridlines()
                .tickSize(-height_lines)
                .tickFormat("")
            );

        // add the y grid lines
        svg_lines.append("g")
            .attr("class", "grid")
            .call(make_y_gridlines()
                .tickSize(-width_lines)
                .tickFormat("")
            );

        // Add the radar line
        svg_lines.append("path")
            .datum(data)
            .attr("class", "line-rdr")
            .attr("d", line_rdr);

        // Add the measurement line
        svg_lines.append("path")
            .datum(data)
            .attr("class", "line-msr")
            .attr("d", line_msr);

        // Add the x axes
        svg_lines.append("g")
            .attr("transform", "translate(0," + height_lines + ")")
            .call(xAxis);

        svg_lines.append("g")
            .call(xAxisTop);

        // Add the y axes
        svg_lines.append("g")
            .call(yAxis);

        svg_lines.append("g")
            .attr("transform", "translate("+ width_lines +",0)")
            .call(yAxisRight);


        // ============ Diff Plot ============ //

        // set the scales
        let x_diff = d3.scaleTime().range([0, width_diff]);
        let y_diff = d3.scaleLinear().range([height_diff, 0]);

        // Make the line generator
        let line_diff = d3.line()
            .x(function(d) { return x_diff(d.time) }) // set the x values for the line generator
            .y(function(d) { return y_diff(d.diff) }); // set the y values for the line generator

        // Set the domain the axis
        x_diff.domain(d3.extent(data, function(d) { return d.time }));
        y_diff.domain([ d3.min(data, function(d){ return d.diff }) - 2,
                        d3.max(data, function(d){ return d.diff }) + 2]);

        // set the axis
        let xAxis_diff = d3.axisBottom(x_diff).ticks(0).tickSizeOuter(0);
        let xAxisTop_diff = d3.axisTop(x_diff).ticks(6).tickFormat("");
        let yAxis_diff = d3.axisLeft(y_diff).ticks(6);
        let yAxisRight_diff = d3.axisRight(y_diff).ticks(0).tickSizeOuter(0);

        // grid lines in x axis function
        function make_x_gridlines_diff() {
            return d3.axisBottom(x_diff)
                .ticks(6)
        }

        // add the x gridlines
        svg_diff.append("g")
            .attr("class", "grid")
            .attr("transform", "translate(0," + height_diff + ")")
            .call(make_x_gridlines_diff()
                .tickSize(-height_diff)
                .tickFormat("")
            );

        // Add the difference line
        svg_diff.append("path")
            .datum(data)
            .attr("class", "line-diff")
            .attr("d", line_diff);

        // Add the x axes
        svg_diff.append("g")
            .attr("transform", "translate(0," + height_diff + ")")
            .call(xAxis_diff);

        svg_diff.append("g")
            .call(xAxisTop_diff);

        // Add the y axes
        svg_diff.append("g")
            .call(yAxis_diff);

        svg_diff.append("g")
            .attr("transform", "translate("+ width_diff +",0)")
            .call(yAxisRight_diff);

        // ============ Legend Lines ============ //

        let legend_text = ["Radar", "Measurement"];
        let legend_color = ["orange","blue"];
        let legend_opacity = ["0.5","0.3"];

        // set the dimensions and margins of the legend
        let margin_legend = {top: 10, right: 10, bottom: 10, left: 10},
            width_legend = 140 - margin_legend.left - margin_legend.right,
            height_legend = 75 - margin_legend.top - margin_legend.bottom;

        let legend = svg_lines.append("g")
            .attr("transform", "translate("+ (width_lines - width_legend - margin_legend.left) +"," + margin_legend.top + ")");

        legend.append("rect")
            .attr("class", "legend")
            .attr("width", width_legend)
            .attr("height", height_legend);

        // For each lines add a row
        let legend_item = legend.selectAll("g")
            .data(legend_text)
            .enter()
            .append("g")
            .attr("transform", function (d, i)
                { return "translate(10," + (i * 20 + 10)+ ")" }
            );

        legend_item.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", "12px")
            .attr("height", "12px")
            .style("opacity", function(d, i)
                {return legend_opacity[i]}
            )
            .style("fill", function(d,i)
                { return legend_color[i]}
            );

        legend_item.append("text")
            .attr("x", 20)
            .attr("y", 10)
            .text(function(d){return d;})
            .style("font-size","0.71em")

        // ============ Legend Diff ============ //

        // set the dimensions and margins of the diff legend
        let margin_legend_diff = {top: 10, right: 10, bottom: 10, left: 10},
            width_legend_diff = 140 - margin_legend_diff.left - margin_legend_diff.right;

        let legend_diff = svg_diff.append("g")
            .attr("transform", "translate("+ (width_diff - width_legend_diff - margin_legend_diff.left) +"," + margin_legend_diff.top + ")");

        legend_diff.append("text")
            .text("Radar - Measurement")
            .style("font-size","0.71em")
            .attr("x",8)
            .attr("y",8);
    }

    componentDidMount() {

        // Get the queries ready
        let query_radar = this.queryBuilder(API_URL, API_KEY, API_QUERY_RADAR);
        let query_dbklima = this.queryBuilder(API_URL, API_KEY, API_QUERY_DBKLIMA);

        // Fetch the data from the web services
        const requests = this.dataFetcher(query_radar, query_dbklima);
        Promise.all(requests)

            // Aggregate the data responses
            .then(function(values){
                const combinedData = [];
                for (let i=0; i<values.length; i++){
                    combinedData.push(values[i]);
                }
                return combinedData;
            })

            // Process the data
            .then(data => this.dataProcessing(data))

            // Display the data
            .then(data => this.plot(data.rdr_x, data.rdr_y, data.msr_y));


    }

    render() {
        return(
            <div>
                <h1>Radar vs. Measurements</h1>
                <div className="plot"/>
            </div>
        )
    }
}

export default RadarVsMeasurement