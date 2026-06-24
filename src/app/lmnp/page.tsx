import type { Metadata } from "next";
import LmnpCalculator from "./LmnpCalculator";

export const metadata: Metadata = {
  title: "Simulateur LMNP — Calcul de rentabilité",
  description: "Calculez la rentabilité de votre investissement locatif meublé (LMNP) : loyer estimé, crédit, cash-flow et avantage fiscal.",
};

export default function LmnpPage() {
  return <LmnpCalculator />;
}
