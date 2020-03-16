### Table: `cases`
| Column          | id                 | action             | extras             | message_id         | moderator_id       | reason             | screenshots        | user_ids           |
|-----------------|--------------------|--------------------|--------------------|--------------------|--------------------|--------------------|--------------------|--------------------|
| Type            | INTEGER            | TEXT               | TEXT               | TEXT               | TEXT               | TEXT               | TEXT               | TEXT               |
| Not Null?       | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| Primary Key?    | :heavy_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Auto Increment? | :heavy_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Unique?         | :heavy_check_mark: | :white_check_mark: | :white_check_mark: | :heavy_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Default Value   |                    |                    | '{}'               |                    |                    |                    | '[]'               |                    |


### Table: `warnings`
| Column          | case_id            | moderator_id       | reason             | user_id            | timestamp          |
|-----------------|--------------------|--------------------|--------------------|--------------------|--------------------|
| Type            | INTEGER            | TEXT               | TEXT               | TEXT               | TEXT               |
| Not Null?       | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| Primary Key?    | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Auto Increment? | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Unique?         | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Default Value   |                    |                    |                    |                    |                    |


### Table: `mutes`
| Column          | user_id            | start              | end                |
|-----------------|--------------------|--------------------|--------------------|
| Type            | INTEGER            | TEXT               | TEXT               |
| Not Null?       | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| Primary Key?    | :heavy_check_mark: | :white_check_mark: | :white_check_mark: |
| Auto Increment? | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Unique?         | :heavy_check_mark: | :white_check_mark: | :white_check_mark: |
| Default Value   |                    |                    |                    |