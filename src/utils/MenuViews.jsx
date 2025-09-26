import { useState } from "react";

export default function MenuViews(initialView) {
  const [view, setView] = useState(initialView);
  const [previousViews, setPreviousViews] = useState([]);
  
  function goToView(newView) {
    setPreviousViews(s => [...s, view]);
    setView(newView);
  }
  
  function goToPreviousView() {
    const canGoBack = previousViews.length !== 0;
    if(canGoBack) {
      setView(previousViews[previousViews.length - 1]);
      setPreviousViews(previousState => previousState.slice(0, previousState.length - 1));
    }
    return canGoBack;
  }

  return {view, goToView, goToPreviousView};
}
