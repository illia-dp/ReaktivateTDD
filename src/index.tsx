import React from "react";
import ReactDOM from "react-dom";
import { App } from "./App";
import { createApplication } from "./createApplication";
import { configure } from "mobx";
import "./styles.css";

configure({ enforceActions: "always" });
ReactDOM.render(
  <App createApplication={createApplication} />,
  document.getElementById("root"),
);
