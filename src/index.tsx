import React from "react";
import ReactDOM from "react-dom";
import { App } from "./App";
import { createApplication } from "./createApplication";
import "./styles.css";

const controller = createApplication();
ReactDOM.render(<App controller={controller} />, document.getElementById("root"));
