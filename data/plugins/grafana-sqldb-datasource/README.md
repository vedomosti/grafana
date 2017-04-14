# grafana-sqldb-datasource

SQL DB database is the datasource of Grafana 3.0, which provides the support of both of MySQL and PostgreSQL as a backend database.

## Features

### 1. Query Editor

Forked from influxDB plugin, this datasource frontend has been implemented. Therefore, you can issue SQL queries in the same manner as in influxDB.

(Defining with query editor)<br>
![Query Editor](https://github.com/sraoss/grafana-sqldb-datasource/wiki/images/query-editor.png)

Each parts (schema, table, column name and data type) refer to information_schema in RDB.

### 2. Text Editor Mode (support raw SQL)

You can switch to raw query mode by clicking icon.

(Toggling edit mode)<br>
![Query Editor](https://github.com/sraoss/grafana-sqldb-datasource/wiki/images/rawquery.png)

Raw queries are generated refering to inputs of query editor. You can modify them (add JOIN another tables, sub queries in WHERE clause, and so on).

#### Macros

If you tries to mpdify a raw query or define it by yourself without choosing parts in query editor, you can use these macros.

| macro | detail |
|:------|:-------|
| $timeColumn | This is replaced to "TIME" from [TIME : TYPE] in query editor. |
| $timeFilter | This is replaced to "<code>$timeColumn < $from AND $timeColumn > $to</code>". |
| $from | This is replaced to "from" word of the time range for panels, and this is casted as "TYPE" from [TIME : TYPE] in query editor. |
| $to   | This is replaced to "to" of the time range for panels, and this is casted as "TYPE" from [TIME : TYPE] in query editor.|
| $unixFrom | This is replaced to "from" of the time range for panels, and this is casted as number of unix timestamp. |
| $unixTo   | This is replaced to "to" of the time range for panels, and this is casted as number of unix timestamp. |
| $timeFrom | This is replaced to "from" of the time range for panels, and this is casted as timestamp. |
| $timeTo   | This is replaced to "to" of the time range for panels, and this is casted as timestamp. |

### 3. Templating

You can create a template variable in Grafana and have that variable filled with values from any SQL Database metric exploration query. Then, You can use this variable in your SQL Database metric queries.

(Defining a template)<br>
![Template Editor](https://github.com/sraoss/grafana-sqldb-datasource/wiki/images/template_var.png)

(Use a template vartiable in query editor)<br>
![Query Editor](https://github.com/sraoss/grafana-sqldb-datasource/wiki/images/template_tag.png)


### 4. Annotations

Annotaions is also supported. You can issue SQL queries and add event information above graphes.　

(Defining an annotation)<br>
![Annotaions Editor](https://github.com/sraoss/grafana-sqldb-datasource/wiki/images/annotation.png)

(Annotations in a graph)<br>
![Annotaions Graph](https://github.com/sraoss/grafana-sqldb-datasource/wiki/images/annotation_graph.png)

### 5. Using timestamp and unixtimestamp as a time-serise column

You can choose a time-serise column from the table definition.

(Choosing the column for time series)<br>
![time series](https://github.com/sraoss/grafana-sqldb-datasource/wiki/images/time-series.png)

#### Data types

The supported data types for time-serise are:

| category | PostgreSQL | MySQL |
|:---------|:-----------|:-------|
| timestamp type | timestamp without time zone <br> timestamp with time zone | timestamp <br> datetime |
| number type <br> (if you use unixtimesamp as a time-serise column) | bigint <br> integer (int) <br> float <br> real <br> double precision <br> decimal <br> numeric | bigint <br> integer (int) <br> float <br> real <br> double precision <br> decimal <br> numeric |

## Example
### Query with variables
```
SELECT $unixtimeColumn * 1000 AS time_msec,
       avg(cpu_usr)
       FROM myschema.dstat
       WHERE tag ~* '/^$host_t$/' AND
             $timeFilter
GROUP BY $unixtimeColumn
ORDER BY $unixtimeColumn
```

### Actual query in PostgreSQL
#### timestamp type
```
SELECT round(extract(epoch from coltime::timestamptz) / 1200) * 1200 * 1000 AS time_msec,
       avg(cpu_usr)
       FROM myschema.dstat
       WHERE tag ~* '/^webserver123$/' AND
coltime > (now() - '7d'::interval)
GROUP BY round(extract(epoch from coltime::timestamptz) / 1200) * 1200
ORDER BY round(extract(epoch from coltime::timestamptz) / 1200) * 1200
```

#### number type
```
SELECT round(coltime / 1200) * 1200 * 1000 AS time_msec,
       avg(cpu_usr)
       FROM myschema.dstat
       WHERE tag ~* '/^webserver123$/' AND
coltime > extract(epoch from (now() - '7d'::interval)::timestamptz)
GROUP BY round(coltime / 1200) * 1200
ORDER BY round(coltime / 1200) * 1200
```

### Actual query in MySQL
#### timestamp type
```
SELECT (UNIX_TIMESTAMP(coltime) DIV 1200) * 1200 * 1000 AS time_msec,
       avg(cpu_usr)
       FROM myschema.dstat
       WHERE tag REGEXP '^webserver123$' AND
             coltime > DATE_SUB(CURDATE(), INTERVAL 7 DAY)
             GROUP BY (UNIX_TIMESTAMP(coltime) DIV 1200) * 1200
             ORDER BY (UNIX_TIMESTAMP(coltime) DIV 1200) * 1200;
```

#### number type
```
SELECT (coltime DIV 1200) * 1200 * 1000 AS time_msec,
       avg(cpu_usr)
       FROM myschema.dstat
       WHERE tag REGEXP '^webserver123$' AND
coltime > UNIX_TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 7 DAY))
GROUP BY (coltime DIV 1200) * 1200
ORDER BY (coltime DIV 1200) * 1200
```

## Tested versions of RDBMS

* PostgreSQL

| 9.5 | 9.4 | 9.3 | 9.2 | 9.1 |
|:----|:----|:----|:----|:----|
| OK  | OK  | (not yet)  | OK | (not yet)  |

* MySQL

| 5.7 | 5.6 | 5.5 |
|:----|:----|:----|
| (not yet) | (not yet) | OK |

## References

* [Generic SQL Datasource [WIP] #3964](https://github.com/grafana/grafana/pull/3964)
