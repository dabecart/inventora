import { useState } from "react";

export default function MenuViews(initialView, setGlobalMenuName, menuNames = {}) {
  const [view, setView] = useState(initialView);
  const [previousViews, setPreviousViews] = useState([]);
  const [direction, setDirection] = useState(1); // 1: forwards, -1: backwards
  
  function goToView(newView) {
    setPreviousViews(s => [...s, view]);
    setView(newView);
    setGlobalMenuName(menuNames[newView]);
    setDirection(1);
  }
  
  function goToPreviousView() {
    const canGoBack = previousViews.length !== 0;
    if(canGoBack) {
      const previousView = previousViews[previousViews.length - 1];
      setView(previousView);
      setPreviousViews(previousState => previousState.slice(0, previousState.length - 1));
      setGlobalMenuName(menuNames[previousView]);
    }
    setDirection(-1);
    return canGoBack;
  }

  function getCurrentMenuName() {
    return menuNames[view];
  }

  return {view, direction, goToView, goToPreviousView, getCurrentMenuName};
}
