import { ChartTheme } from './ChartTheme';
import { DashboardRevenueChart } from './DashboardRevenueChart';
import { DashboardProductCharts } from './DashboardProductCharts';
export default function DashboardCharts({revision}:{revision:number}){return <ChartTheme><DashboardProductCharts revision={revision}/><DashboardRevenueChart revision={revision}/></ChartTheme>;}
