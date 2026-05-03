import { useState, useCallback } from "react";
import { Calculator, PoundSterling } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

const BOE_RATE = 4.25; // Bank of England base rate — hardcoded May 2026

interface MortgageCalculatorProps {
  suggestedPrice?: number; // Optional — pre-fills the property price
}

function formatPound(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function parsePound(s: string): number {
  return parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
}

export function MortgageCalculator({ suggestedPrice }: MortgageCalculatorProps) {
  const defaultPrice = suggestedPrice ?? 350000;
  const [priceStr, setPriceStr] = useState(defaultPrice.toLocaleString("en-GB"));
  const [depositPct, setDepositPct] = useState(20);
  const [termYears, setTermYears] = useState(25);

  const propertyPrice = parsePound(priceStr);
  const deposit = propertyPrice * (depositPct / 100);
  const loanAmount = propertyPrice - deposit;

  // Add a typical lender margin above BoE rate
  const lenderMargin = depositPct >= 40 ? 1.0 : depositPct >= 25 ? 1.3 : depositPct >= 15 ? 1.6 : 2.0;
  const annualRate = BOE_RATE + lenderMargin;
  const monthlyRate = annualRate / 100 / 12;
  const nPayments = termYears * 12;

  const monthlyPayment =
    loanAmount > 0 && monthlyRate > 0
      ? (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, nPayments))) /
        (Math.pow(1 + monthlyRate, nPayments) - 1)
      : 0;

  const totalRepaid = monthlyPayment * nPayments;
  const totalInterest = totalRepaid - loanAmount;
  const ltv = propertyPrice > 0 ? ((loanAmount / propertyPrice) * 100).toFixed(0) : "0";

  const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const num = parseInt(raw, 10);
    setPriceStr(isNaN(num) ? "" : num.toLocaleString("en-GB"));
  }, []);

  return (
    <div className="space-y-5" data-testid="mortgage-calculator">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="mc-price" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Property Price
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
            <Input
              id="mc-price"
              className="pl-7 h-9 text-sm font-medium"
              value={priceStr}
              onChange={handlePriceChange}
              data-testid="input-mc-price"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Mortgage Term
          </Label>
          <div className="flex items-center gap-2 h-9">
            {[15, 20, 25, 30, 35].map((y) => (
              <button
                key={y}
                onClick={() => setTermYears(y)}
                className={`flex-1 h-full rounded text-xs font-semibold transition-colors ${
                  termYears === y
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid={`button-term-${y}`}
              >
                {y}yr
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Deposit slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Deposit
          </Label>
          <span className="text-sm font-bold text-foreground">
            {depositPct}% — {formatPound(deposit)}
          </span>
        </div>
        <Slider
          min={5}
          max={60}
          step={5}
          value={[depositPct]}
          onValueChange={([v]) => setDepositPct(v)}
          data-testid="slider-deposit"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>5%</span>
          <span>LTV: {ltv}%</span>
          <span>60%</span>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Estimated Monthly Payment</span>
          </div>
          <span className="text-xs text-muted-foreground">
            BoE {BOE_RATE}% + {lenderMargin}% margin
          </span>
        </div>
        <p className="text-3xl font-bold text-foreground mb-1">
          {monthlyPayment > 0 ? formatPound(monthlyPayment) : "—"}
          <span className="text-sm font-normal text-muted-foreground ml-1">/month</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Estimated rate: {annualRate.toFixed(2)}% p.a. (repayment mortgage)
        </p>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-muted/40">
          <p className="text-sm font-bold text-foreground">{formatPound(loanAmount)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Loan Amount</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/40">
          <p className="text-sm font-bold text-foreground">{formatPound(totalInterest)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Interest</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/40">
          <p className="text-sm font-bold text-foreground">{formatPound(totalRepaid)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Repaid</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Illustrative only. Actual rates depend on your credit score, lender, and chosen product.
        Bank of England base rate {BOE_RATE}% (May 2026). Lender margin estimate based on deposit size.
        Always obtain a Decision in Principle from a regulated mortgage broker.
      </p>
    </div>
  );
}
