define([
  'lodash',
  'app/core/table_model',
],
function (_, TableModel) {
  'use strict';

  function SqlSeries(options) {
    this.series = options.series;
    this.table = options.table;
    this.alias = options.alias;
    this.groupBy = options.groupBy;
    this.annotation = options.annotation;
  }

  var p = SqlSeries.prototype;


  p.getTimeSeries = function() {
    var output = [];
    var self = this;

    if (self.series.length === 0) {
      return output;
    }

    var seriesName = self.table;

    var seriesDatapoints = {};
    _.each(self.series.values, function(row) {
      var tags = [];
      var tagsStr = '';
      _.each(self.groupBy, function(groupBy, k) {
        if (k !== 0) {
          tags.push(groupBy.params[0] + ': ' + row[k]);
        }
      });
      if (tags.length !== 0) {
        tagsStr = ' {' + tags.join(', ') + '}';
      }

      _.each(row, function(value, i) {
        if (i < self.groupBy.length) {
            return;
        }
        var columnName = self.series.columns[i];
        if (columnName !== 'value') {
          seriesName = seriesName + '.' + columnName;
        }
        if (self.alias) {
          seriesName = self._getSeriesName(self.series, i);
        }
        seriesName = seriesName + tagsStr;

        if (! seriesDatapoints[seriesName]) {
          seriesDatapoints[seriesName] = [];
        }

        seriesDatapoints[seriesName].push([
          self._formatValue(value),   // numeric value
          self._formatValue(row[0])   // timestamp
        ]);
      });
    });

    _.each(seriesDatapoints, function(datapoints, seriesName) {
      output.push({ target: seriesName, datapoints: datapoints });
    });

    return output;
  };

  p._getSeriesName = function(series, index) {
    var self = this;
    var regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;

    return this.alias.replace(regex, function(match, g1, g2) {
      var group = g1 || g2;

      if (group === 't' || group === 'table') { return self.table || series.name; }
      if (group === 'col') { return series.columns[index]; }

      return match;
    });
  };

  p.getAnnotations = function () {
    var list = [];
    var self = this;

    _.each(this.series, function (series) {
      var titleCol = null;
      var timeCol = null;
      var tagsCol = null;
      var textCol = null;

      _.each(series.columns, function(column, index) {
        if (column === 'time') { timeCol = index; return; }
        if (column === 'tags') { tagsCol = index; return; }
        if (column === 'title') { titleCol = index; return; }
        if (column === 'text') { textCol = index; return; }
        if (!titleCol) { titleCol = index; }
      });

      _.each(series.values, function (value) {
        var data = {
          annotation: self.annotation,
          time: + new Date(self._formatValue(value[timeCol])),
          title: value[titleCol],
          tags: value[tagsCol],
          text: value[textCol]
        };

        list.push(data);
      });
    });

    return list;
  };

  p.getTable = function() {
    var table = new TableModel.default();
    var self = this;

    _.each(self.series.columns, function(column) {
      table.columns.push({ text: column });
    });

    _.each(self.series.values, function(row) {
      var formated = _.map(row, function(value) {
        return self._formatValue(value);
      });

      table.rows.push(formated);
    });

    return table;
  };

  p.getDocs = function() {
    var self = this;
    var rows = { datapoints: [], target: self.series.name, type: 'docs' };

    _.each(self.series.values, function(values) {
      var formated = {};

      _.each(values, function(value, i) {
        var column = self.series.columns[i];
        formated[column] = self._formatValue(value);
      });

      rows.datapoints.push(formated);
    });

    return rows;
  };

  p._formatValue = function(value) {
    var v_numeric = Number(value);

    if (isNaN(value)) {
      return value;
    } else {
      return parseFloat(v_numeric);
    }
  };

  return SqlSeries;
});
