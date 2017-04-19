///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import * as FileExport from 'app/core/utils/file_export';
import {MetricsPanelCtrl} from 'app/plugins/sdk';
import {transformDataToTable} from './transformers';
import {tablePanelEditor} from './editor';
import {TableRenderer} from './renderer';

class TablePanelCtrl extends MetricsPanelCtrl {
  static templateUrl = 'module.html';

  pageIndex: number;
  dataRaw: any;
  table: any;

  panelDefaults = {
    targets: [{}],
    transform: 'timeseries_to_columns',
    pageSize: null,
    showHeader: true,
    styles: [
      {
        type: 'date',
        pattern: 'Time',
        dateFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      {
        unit: 'short',
        type: 'number',
        decimals: 2,
        colors: ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"],
        colorMode: null,
        pattern: '/.*/',
        thresholds: [],
      }
    ],
    columns: [],
    scroll: true,
    fontSize: '100%',
    sort: {col: 0, desc: true},
    filterNull: false,
  };

  /** @ngInject */
  constructor($scope, $injector, private annotationsSrv, private $sanitize, private backendSrv) {
    super($scope, $injector);
    this.pageIndex = 0;

    if (this.panel.styles === void 0) {
      this.panel.styles = this.panel.columns;
      this.panel.columns = this.panel.fields;
      delete this.panel.columns;
      delete this.panel.fields;
    }

    _.defaults(this.panel, this.panelDefaults);

    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('init-panel-actions', this.onInitPanelActions.bind(this));
  }

  onInitEditMode() {
    this.addEditorTab('Options', tablePanelEditor, 2);
  }

  onInitPanelActions(actions) {
    actions.push({text: 'Export CSV', click: 'ctrl.exportCsv()'});
  }

  issueQueries(datasource) {
    this.pageIndex = 0;

    if (this.panel.transform === 'annotations') {
      this.setTimeQueryStart();
      return this.annotationsSrv.getAnnotations({dashboard: this.dashboard, panel: this.panel, range: this.range})
      .then(annotations => {
        return {data: annotations};
      });
    }

    return super.issueQueries(datasource);
  }

  onDataError(err) {
    this.dataRaw = [];
    this.render();
  }

  onDataReceived(dataList) {
    var ctrl = this;
    this.loadDocuments(dataList, function(result){
      ctrl.dataRaw = result;
      console.log(ctrl.dataRaw);
      ctrl.pageIndex = 0;

      // automatically correct transform mode based on data
      if (ctrl.dataRaw && ctrl.dataRaw.length) {
        if (ctrl.dataRaw[0].type === 'table') {
          ctrl.panel.transform = 'table';
        } else {
          if (ctrl.dataRaw[0].type === 'docs') {
            ctrl.panel.transform = 'json';
          } else {
            if (ctrl.panel.transform === 'table' || ctrl.panel.transform === 'json') {
              ctrl.panel.transform = 'timeseries_to_rows';
            }
          }
        }
      }

      ctrl.render();
    });
  }

  loadDocuments(data, callback) {
    if (data &&
        data.length &&
        (data[0].type === 'docs') &&
        data[0].datapoints.length &&
        ("tdoc_id" in data[0].datapoints[0])) {
          var datasources = null;
          var backendSrv = this.backendSrv;
          backendSrv.get('/api/datasources')
            .then((result) => {
               datasources = result;
               var snipeDataSource = _.find(datasources, function(datasource){
                return datasource.name.includes('snipe');
               });
              if (snipeDataSource) {
                var doc_ids = _.flatMap(data[0].datapoints, function(obj) {
                  return obj['tdoc_id'];
                });
                  backendSrv.post('/api/datasources/proxy/' + snipeDataSource.id + '/query', {
                    query: "select documents.id as tdoc_id, documents.title as tdoc_title," +
                    "(select string_agg(title,',') FROM categories where ARRAY[documents.category_ids] @> ARRAY[categories.id] " +
                      " AND categories.slug_path ~ 'parts.*{1}') as part," +
                    "(select string_agg(title,',') FROM categories where ARRAY[documents.category_ids] @> ARRAY[categories.id] " +
                      " AND categories.slug_path ~ 'rubrics.*{1}') as rubric," +
                    "urls.rendered as url " +
                    "from documents" +
                    " INNER JOIN urls on urls.id = documents.url_id " +
                    " where documents.id in (" + _.join(doc_ids, ',')  + ")"
                  }).then((documents) => {
                    if (documents.results[0].series[0].values.length) {
                      _.forEach(documents.results[0].series[0].values, function(document) {
                        var doc_index = _.findIndex(data[0].datapoints, function(datapoint) {
                          return datapoint['tdoc_id'] === document[0];
                        });
                        if (doc_index !== -1) {
                          data[0].datapoints[doc_index] = _.merge(data[0].datapoints[doc_index], {
                            title: document[1],
                            part: document[2],
                            rubric: document[3],
                            url: document[4]
                          });
                        }
                      });
                      callback(data);
                    } else {
                      callback(data);
                    }
                  });
              } else {
                callback(data);
              }
            });
    } else {
      return callback(data);
    }
  }
  render() {
    this.table = transformDataToTable(this.dataRaw, this.panel);
    this.table.sort(this.panel.sort);
    return super.render(this.table);
  }

  toggleColumnSort(col, colIndex) {
    // remove sort flag from current column
    if (this.table.columns[this.panel.sort.col]) {
      this.table.columns[this.panel.sort.col].sort = false;
    }

    if (this.panel.sort.col === colIndex) {
      if (this.panel.sort.desc) {
        this.panel.sort.desc = false;
      } else {
        this.panel.sort.col = null;
      }
    } else {
      this.panel.sort.col = colIndex;
      this.panel.sort.desc = true;
    }
    this.render();
  }

  exportCsv() {
    var renderer = new TableRenderer(this.panel, this.table, this.dashboard.isTimezoneUtc(), this.$sanitize);
    FileExport.exportTableDataToCsv(renderer.render_values());
  }

  link(scope, elem, attrs, ctrl) {
    var data;
    var panel = ctrl.panel;
    var pageCount = 0;
    var formaters = [];

    function getTableHeight() {
      var panelHeight = ctrl.height;

      if (pageCount > 1) {
        panelHeight -= 26;
      }

      return (panelHeight - 31) + 'px';
    }

    function appendTableRows(tbodyElem) {
      var renderer = new TableRenderer(panel, data, ctrl.dashboard.isTimezoneUtc(), ctrl.$sanitize);
      tbodyElem.empty();
      tbodyElem.html(renderer.render(ctrl.pageIndex));
    }

    function switchPage(e) {
      var el = $(e.currentTarget);
      ctrl.pageIndex = (parseInt(el.text(), 10)-1);
      renderPanel();
    }

    function appendPaginationControls(footerElem) {
      footerElem.empty();

      var pageSize = panel.pageSize || 100;
      pageCount = Math.ceil(data.rows.length / pageSize);
      if (pageCount === 1) {
        return;
      }

      var startPage = Math.max(ctrl.pageIndex - 3, 0);
      var endPage = Math.min(pageCount, startPage + 9);

      var paginationList = $('<ul></ul>');

      for (var i = startPage; i < endPage; i++) {
        var activeClass = i === ctrl.pageIndex ? 'active' : '';
        var pageLinkElem = $('<li><a class="table-panel-page-link pointer ' + activeClass + '">' + (i+1) + '</a></li>');
        paginationList.append(pageLinkElem);
      }

      footerElem.append(paginationList);
    }

    function renderPanel() {
      var panelElem = elem.parents('.panel');
      var rootElem = elem.find('.table-panel-scroll');
      var tbodyElem = elem.find('tbody');
      var footerElem = elem.find('.table-panel-footer');

      elem.css({'font-size': panel.fontSize});
      panelElem.addClass('table-panel-wrapper');

      appendTableRows(tbodyElem);
      appendPaginationControls(footerElem);

      rootElem.css({'max-height': panel.scroll ? getTableHeight() : '' });
    }

    elem.on('click', '.table-panel-page-link', switchPage);

    var unbindDestroy = scope.$on('$destroy', function() {
      elem.off('click', '.table-panel-page-link');
      unbindDestroy();
    });

    ctrl.events.on('render', function(renderData) {
      data = renderData || data;
      if (data) {
        renderPanel();
      }
      ctrl.renderingCompleted();
    });
  }
}

export {
  TablePanelCtrl,
  TablePanelCtrl as PanelCtrl
};
