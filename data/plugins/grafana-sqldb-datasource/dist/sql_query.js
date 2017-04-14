///<reference path="app/headers/common.d.ts" />
System.register(['lodash', './query_part'], function(exports_1) {
    var lodash_1, query_part_1;
    var SqlQuery;
    return {
        setters:[
            function (lodash_1_1) {
                lodash_1 = lodash_1_1;
            },
            function (query_part_1_1) {
                query_part_1 = query_part_1_1;
            }],
        execute: function() {
            SqlQuery = (function () {
                /** @ngInject */
                function SqlQuery(target, templateSrv, scopedVars) {
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
                        { type: 'time', params: ['$interval'] },
                    ];
                    target.targetLists = target.targetLists || [[
                            { type: 'field', params: ['*'] },
                            { type: 'count', params: [] },
                        ]];
                    target.alias = target.alias || '$t.$col';
                    this.updateProjection();
                }
                SqlQuery.prototype.updateProjection = function () {
                    this.selectModels = lodash_1.default.map(this.target.targetLists, function (parts) {
                        return lodash_1.default.map(parts, query_part_1.default.create);
                    });
                    this.groupByParts = lodash_1.default.map(this.target.groupBy, query_part_1.default.create);
                };
                SqlQuery.prototype.updatePersistedParts = function () {
                    this.target.targetLists = lodash_1.default.map(this.selectModels, function (selectParts) {
                        return lodash_1.default.map(selectParts, function (part) {
                            return { type: part.def.type, params: part.params };
                        });
                    });
                };
                SqlQuery.prototype.hasGroupByTime = function () {
                    return lodash_1.default.find(this.target.groupBy, function (g) { return g.type === 'time'; });
                };
                SqlQuery.prototype.addGroupBy = function (value) {
                    var stringParts = value.match(/^(\w+)\((.*)\)$/);
                    var typePart = stringParts[1];
                    var arg = stringParts[2];
                    var partModel = query_part_1.default.create({ type: typePart, params: [arg] });
                    var partCount = this.target.groupBy.length;
                    if (partCount === 0) {
                        this.target.groupBy.push(partModel.part);
                    }
                    else if (typePart === 'time') {
                        this.target.groupBy.splice(0, 0, partModel.part);
                    }
                    else {
                        this.target.groupBy.push(partModel.part);
                    }
                    this.updateProjection();
                };
                SqlQuery.prototype.removeGroupByPart = function (part, index) {
                    var categories = query_part_1.default.getCategories();
                    if (part.def.type === 'time') {
                        // remove aggregations
                        this.target.targetLists = lodash_1.default.map(this.target.targetLists, function (s) {
                            return lodash_1.default.filter(s, function (part) {
                                var partModel = query_part_1.default.create(part);
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
                };
                SqlQuery.prototype.removeSelect = function (index) {
                    this.target.targetLists.splice(index, 1);
                    this.updateProjection();
                };
                SqlQuery.prototype.removeSelectPart = function (selectParts, part) {
                    // if we remove the field remove the whole statement
                    if (part.def.type === 'field') {
                        if (this.selectModels.length > 1) {
                            var modelsIndex = lodash_1.default.indexOf(this.selectModels, selectParts);
                            this.selectModels.splice(modelsIndex, 1);
                        }
                    }
                    else {
                        var partIndex = lodash_1.default.indexOf(selectParts, part);
                        selectParts.splice(partIndex, 1);
                    }
                    this.updatePersistedParts();
                };
                SqlQuery.prototype.addSelectPart = function (selectParts, type) {
                    var partModel = query_part_1.default.create({ type: type });
                    partModel.def.addStrategy(selectParts, partModel, this);
                    this.updatePersistedParts();
                };
                SqlQuery.prototype.renderTagCondition = function (tag, index, interpolate) {
                    var str = "";
                    var operator = tag.operator;
                    var value = tag.value;
                    if (index > 0) {
                        str = (tag.condition || 'AND') + ' ';
                    }
                    if (!operator) {
                        if (/^\/.*\/$/.test(value)) {
                            operator = '=~';
                        }
                        else {
                            operator = '=';
                        }
                    }
                    // quote value unless regex
                    var matchOperators = query_part_1.default.getMatchOperators(this.dbms);
                    if (!matchOperators || (operator !== matchOperators.match && operator !== matchOperators.not)) {
                        if (interpolate) {
                            value = this.templateSrv.replace(value, this.scopedVars);
                        }
                        if (operator !== '>' && operator !== '<') {
                            value = "'" + value.replace('\\', '\\\\') + "'";
                        }
                    }
                    else if (interpolate) {
                        value = this.templateSrv.replace(value, this.scopedVars, 'regex');
                        value = "'" + value.replace(/^\//, '').replace(/\/$/, '') + "'";
                    }
                    else {
                        value = "'" + value.replace(/^\//, '').replace(/\/$/, '') + "'";
                    }
                    return str + tag.key + ' ' + operator + ' ' + value;
                };
                SqlQuery.prototype.gettableAndSchema = function (interpolate) {
                    var schema = this.target.schema;
                    var table = this.target.table || 'table';
                    if (!table.match('^/.*/')) {
                        table = table;
                    }
                    else if (interpolate) {
                        table = this.templateSrv.replace(table, this.scopedVars, 'regex');
                    }
                    if (schema !== 'default') {
                        schema = this.target.schema + '.';
                    }
                    else {
                        schema = "";
                    }
                    var rtn = schema + table;
                    return rtn;
                };
                SqlQuery.prototype.render = function (interpolate) {
                    var _this = this;
                    var target = this.target;
                    if (target.rawQuery) {
                        if (interpolate) {
                            return this.templateSrv.replace(target.query, this.scopedVars, 'regex');
                        }
                        else {
                            return target.query;
                        }
                    }
                    var hasTimeGroupBy = false;
                    var groupByClause = '';
                    var orderByClause = '';
                    var query = 'SELECT ';
                    if (target.groupBy.length !== 0) {
                        lodash_1.default.each(this.target.groupBy, function (groupBy, i) {
                            if (i !== 0) {
                                query += ', ';
                                groupByClause += ', ';
                            }
                            switch (groupBy.type) {
                                case 'time':
                                    query += '$unixtimeColumn * 1000 AS time_msec';
                                    groupByClause = '$unixtimeColumn * 1000';
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
                        var parts = this.selectModels[i];
                        var selectText = "";
                        for (j = 0; j < parts.length; j++) {
                            var part = parts[j];
                            selectText = part.render(selectText);
                        }
                        if (i > 0) {
                            targetList += ', ';
                        }
                        targetList += selectText;
                    }
                    query += targetList;
                    query += ' FROM ' + this.gettableAndSchema(interpolate) + ' WHERE ';
                    var conditions = lodash_1.default.map(target.tags, function (tag, index) {
                        return _this.renderTagCondition(tag, index, interpolate);
                    });
                    query += conditions.join(' ');
                    query += (conditions.length > 0 ? ' AND ' : '') + '$timeFilter';
                    if (groupByClause) {
                        query += ' GROUP BY ' + groupByClause;
                    }
                    orderByClause = groupByClause || targetList;
                    query += ' ORDER BY ' + orderByClause;
                    return query;
                };
                return SqlQuery;
            })();
            exports_1("default", SqlQuery);
        }
    }
});
//# sourceMappingURL=sql_query.js.map