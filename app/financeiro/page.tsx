import { notFound } from "next/navigation";
import { isFinanceEnabled } from "../../lib/finance-feature";
import FinanceApp from "./FinanceApp";

export default async function FinancePage() {
  if (!(await isFinanceEnabled())) notFound();
  return <FinanceApp/>;
}
