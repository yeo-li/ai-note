import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QuickCapturePane } from "./components/QuickCapturePane";
import { readLaunchContext } from "./domain/launch-context";
import "./styles.css";

const launchContext = readLaunchContext();
const RootView = launchContext.quickCaptureMode ? QuickCapturePane : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootView />
  </React.StrictMode>
);
