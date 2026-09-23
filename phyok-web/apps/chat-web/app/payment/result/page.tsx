import { Suspense } from "react";

import { PaymentResultClient } from "./payment-result-client";

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <main className="payment-result-shell">
          <section className="payment-result-card">
            <div className="hero-kicker">Alipay Result</div>
            <h1>正在打开支付结果...</h1>
            <div className="payment-result-banner">正在准备支付结果页，请稍候。</div>
          </section>
        </main>
      }
    >
      <PaymentResultClient />
    </Suspense>
  );
}
