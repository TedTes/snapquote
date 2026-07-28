import type { DemoPlaybackState } from "./engine/types";
import { ScenarioPlayer } from "./engine/ScenarioPlayer";
import { screenSide } from "./engine/playback";
import { quoteFlowScenario } from "./scenarios/quoteFlowScenario";
import { DemoCustomerScreen } from "./screens/DemoCustomerScreen";
import { DemoDashboardScreen } from "./screens/DemoDashboardScreen";
import { DemoDraftReviewScreen } from "./screens/DemoDraftReviewScreen";
import { DemoJobScreen } from "./screens/DemoJobScreen";
import { DemoNotesScreen } from "./screens/DemoNotesScreen";
import { DemoPreviewScreen } from "./screens/DemoPreviewScreen";
import { DemoQuotesScreen } from "./screens/DemoQuotesScreen";
import { DemoSentScreen } from "./screens/DemoSentScreen";
import { DemoCustomerEmailScreen } from "./screens/DemoCustomerEmailScreen";
import { DemoPublicQuoteScreen } from "./screens/DemoPublicQuoteScreen";
import { DemoPaymentScreen } from "./screens/DemoPaymentScreen";
import "./styles/demo-flow.css";

const providerScenario = quoteFlowScenario.filter(
  (step) => screenSide(step.screen) === "provider" && ["notes", "draftReview", "preview", "sent"].includes(step.screen),
);
const customerScenario = quoteFlowScenario.filter((step) => screenSide(step.screen) === "customer");

export function ProductFlowDemo() {
  return (
    <ScenarioPlayer
      className="qv-provider-stage"
      steps={providerScenario}
      renderScreen={renderProviderScreen}
      timeScale={1.72}
    />
  );
}

export function CustomerResponseDemo() {
  return <ScenarioPlayer className="qv-customer-stage" steps={customerScenario} renderScreen={renderCustomerScreen} />;
}

function renderProviderScreen(state: DemoPlaybackState) {
  switch (state.step.screen) {
    case "dashboard":
      return <DemoDashboardScreen playback={state} />;
    case "customer":
      return <DemoCustomerScreen playback={state} />;
    case "job":
      return <DemoJobScreen playback={state} />;
    case "notes":
      return <DemoNotesScreen playback={state} />;
    case "draftReview":
      return <DemoDraftReviewScreen playback={state} />;
    case "preview":
      return <DemoPreviewScreen playback={state} />;
    case "sent":
      return <DemoSentScreen playback={state} />;
    case "quotes":
      return <DemoQuotesScreen />;
    default:
      return null;
  }
}

function renderCustomerScreen(state: DemoPlaybackState) {
  switch (state.step.screen) {
    case "customerEmail":
      return <DemoCustomerEmailScreen playback={state} />;
    case "publicQuote":
      return <DemoPublicQuoteScreen playback={state} />;
    case "payment":
      return <DemoPaymentScreen playback={state} />;
    default:
      return null;
  }
}
