import {productFacts,productSummary} from './content';
import './product-overview.css';

export function ProductOverview(){
 return <section id="about-posjung" className="landing-overview" aria-labelledby="overview-heading"><div className="landing-container">
  <h2 id="overview-heading">POSJung คืออะไร?</h2>
  <p className="landing-overview-summary">{productSummary}</p>
  <dl className="landing-overview-facts">{productFacts.map(fact=><div key={fact.label}><dt>{fact.label}</dt><dd>{fact.text} <a href={fact.href}>ดูรายละเอียด<span className="landing-sr-only"> {fact.label}</span></a></dd></div>)}</dl>
 </div></section>;
}
