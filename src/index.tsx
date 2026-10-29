import React from "react";
import ReactDOM from "react-dom";
import { App } from "./App";
import { createApplication } from "./createApplication";
import "./styles.css";

ReactDOM.render(<App createController={createApplication} />, document.getElementById("root"));
