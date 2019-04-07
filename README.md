

# Meteotest Trial Day Challenge

During my trial day at [Meteotest AG](https://meteotest.ch/), I had the challenge to plot the difference between two timeseries of rain values coming from two different data sources: radar and measurement.

The task has been completed in a React environment created with the help of create-react-app and includes:

* data gathering making requests to an in-house service
* data preprocessing by interpolation of the time series to make them similar 
* plot the time series with a custom plot using D3.js

The interesting piece of code is here: https://github.com/fredmontet/meteotest-trial-day/blob/master/src/components/RadarVsMeasurement/index.js

## Result

![Plot screenshot](https://github.com/fredmontet/meteotest-trial-day/blob/master/public/screenshot.png)
