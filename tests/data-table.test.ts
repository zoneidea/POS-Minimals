import { expect,it } from 'vitest';
import { TABLE_PAGE_SIZE,tablePagination } from '../apps/web/src/components/DataTable';
it('uses ten rows per page',()=>expect(TABLE_PAGE_SIZE).toBe(10));
it.each([
 {total:0,page:1,pages:1,start:0,end:0},
 {total:10,page:1,pages:1,start:1,end:10},
 {total:11,page:2,pages:2,start:11,end:11},
 {total:32,page:4,pages:4,start:31,end:32},
])('calculates page boundaries for $total rows on page $page',({total,page,...result})=>expect(tablePagination(total,page)).toEqual(result));
