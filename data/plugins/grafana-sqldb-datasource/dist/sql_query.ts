///<reference path="app/headers/common.d.ts" />

import _ from 'lodash';
import queryPart from './query_part';

export default class SqlQuery {
  dbms: string;
  target: any;
  selectModels: any[];
  queryBuilder: any;
  groupByParts: any;
  templateSrv: any;
  scopedVars: any;

  /** @ngInject */
  constructor(target, templateSrv?, scopedVars?) {
    this.dbms = null;
    this.target = target;
    this.templateSrv = templateSrv;
    this.scopedVars = scopedVars;

    target.schema = target.schema;
    target.dsType = 'sqldb';
    target.timeColDataType = target.timeColDataType;
    target.resultFormat = target.resultFormat || 'time_series';
    target.tags = target.tags || [];
    target.groupBy = target.groupBy || [
      {type: 'time', params: ['$interval']},
    ];
    target.targetLists = target.targetLists || [[
      {type: 'field', params: ['*']},
      {type: 'count', params: []},
    ]];
    target.alias = target.alias || '$t.$col';

    this.updateProjection();
  }

  updateProjection() {
    this.selectModels = _.map(this.target.targetLists, function(parts: any) {
      return _.map(parts, queryPart.create);
    });
    this.groupByParts = _.map(this.target.groupBy, queryPart.create);
  }

  updatePersistedParts() {
    this.target.targetLists = _.map(this.selectModels, function(selectParts) {
      return _.map(selectParts, function(part: any) {
        return {type: part.def.type, params: part.params};
      });
    });
  }

  hasGroupByTime() {
    return _.find(this.target.groupBy, (g: any) => g.type === 'time');
  }

  addGroupBy(value) {
    var stringParts = value.match(/^(\w+)\((.*)\)$/);
    var typePart = stringParts[1];
    var arg = stringParts[2];
    var partModel = queryPart.create({type: typePart, params: [arg]});
    var partCount = this.target.groupBy.length;

    if (partCount === 0) {
      this.target.groupBy.push(partModel.part);
    } else if (typePart === 'time') {
      this.target.groupBy.splice(0, 0, partModel.part);
    } else {
      this.target.groupBy.push(partModel.part);
    }

    this.updateProjection();
  }

  removeGroupByPart(part, index) {
    var categories = queryPart.getCategories();

    if (part.def.type === 'time') {
      // remove aggregations
      this.target.targetLists = _.map(this.target.targetLists, (s: any) => {
        return _.filter(s, (part: any) => {
          var partModel = queryPart.create(part);
          if (partModel.def.category === categories.Aggregations) {
            return false;
          }
          if (partModel.def.category === categories.Selectors) {
            return false;
          }
          return true;
        });
      });
    }

    this.target.groupBy.splice(index, 1);
    this.updateProjection();
  }

  removeSelect(index: number) {
    this.target.targetLists.splice(index, 1);
    this.updateProjection();
  }

  removeSelectPart(selectParts, part) {
    // if we remove the field remove the whole statement
    if (part.def.type === 'field') {
      if (this.selectModels.length > 1) {
        var modelsIndex = _.indexOf(this.selectModels, selectParts);
        this.selectModels.splice(modelsIndex, 1);
      }
    } else {
      var partIndex = _.indexOf(selectParts, part);
      selectParts.splice(partIndex, 1);
    }

    this.updatePersistedParts();
  }

  addSelectPart(selectParts, type) {
    var partModel = queryPart.create({type: type});
    partModel.def.addStrategy(selectParts, partModel, this);
    this.updatePersistedParts();
  }

  private renderTagCondition(tag, index, interpolate) {
    var str = "";
    var operator = tag.operator;
    var value = tag.value;
    if (index > 0) {
      str = (tag.condition || 'AND') + ' ';
    }

    if (!operator) {
      if (/^\/.*\/$/.test(value)) {
        operator = '=~';
      } else {
        operator = '=';
      }
    }

    // quote value unless regex
    var matchOperators = queryPart.getMatchOperators(this.dbms);
    if (!matchOperators || (operator !== matchOperators.match && operator !== matchOperators.not)) {
      if (interpolate) {
        value = this.templateSrv.replace(value, this.scopedVars);
      }
      if (operator !== '>' && operator !== '<') {
        value = "'" + value.replace('\\', '\\\\') + "'";
      }
    } else if (interpolate){
      value = this.templateSrv.replace(value, this.scopedVars, 'regex');
      value = "'" + value.replace(/^\//, '').replace(/\/$/, '') + "'";
    } else {
      value = "'" + value.replace(/^\//, '').replace(/\/$/, '') + "'";
    }

    return str + tag.key + ' ' + operator + ' ' + value;
  }

  gettableAndSchema(interpolate) {
    var schema = this.target.schema;
    var table = this.target.table || 'table';

    if (!table.match('^/.*/')) {
      table = table;
    } else if (interpolate) {
      table = this.templateSrv.replace(table, this.scopedVars, 'regex');
    }

    if (schema !== 'default') {
      schema = this.target.schema + '.';
    } else {
      schema = "";
    }

    var rtn = schema + table;

    return rtn;
  }

 render(interpolate?) {
    var target = this.target;

    if (target.rawQuery) {
      if (interpolate) {
        return this.templateSrv.replace(target.query, this.scopedVars, 'regex');
      } else {
        return target.query;
      }
    }

    var hasTimeGroupBy = false;
    var groupByClause = '';
    var orderByClause = '';

    var query = 'SELECT ';

    if (target.groupBy.length !== 0) {
      _.each(this.target.groupBy, function(groupBy, i) {
        if (i !== 0) {
            query += ', ';
            groupByClause += ', ';
        }

        switch (groupBy.type) {
          case 'time':
            query += '$unixtimeColumn * 1000 AS time_msec';
            groupByClause = '$unixtimeColumn * 1000'
            break;

          case 'tag':
            query += groupBy.params[0];
            groupByClause += groupBy.params[0];
            break;
        }
      });

      query += ', ';
    }

    var i, j;
    var targetList = '';
    for (i = 0; i < this.selectModels.length; i++) {
      let parts = this.selectModels[i];
      var selectText = "";
      for (j = 0; j < parts.length; j++) {
        let part = parts[j];
        selectText = part.render(selectText);
      }

      if (i > 0) {
        targetList += ', ';
      }
      targetList += selectText;
    }
    query += targetList;

    query += ' FROM ' + this.gettableAndSchema(interpolate) + ' WHERE ';
    var conditions = _.map(target.tags, (tag, index) => {
      return this.renderTagCondition(tag, index, interpolate);
    });

    query += conditions.join(' ');
    query += (conditions.length > 0 ? ' AND ' : '') + '$timeFilter';

    if (groupByClause) {
      query += ' GROUP BY ' + groupByClause;
    }

    orderByClause = groupByClause || targetList;
    query += ' ORDER BY ' + orderByClause;

    return query;
  }
}
