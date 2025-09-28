import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import AnimatedMenuDiv from "./AnimatedMenuDiv";
import { XIcon, ChevronLeft} from "lucide-react";

import MenuViews from "../utils/MenuViews";

import FoodHelper from "./helpers/FoodHelper";
import CustomHelper from "./helpers/CustomHelper";

export default function HelpersMenu({ storageUnits, metaKeys, onSave, onClose, validationFunction}) {
  const buttonClass = "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl shadow-md w-full h-full bg-gray-800 border hover:shadow-lg";

  // Stores the selected helper and its information.
  const [helperID, setHelperId] = useState(null);
  // Name at the top of the menu.
  const [menuName, setMenuName] = useState('Create new item');
  
  // Used to navigate the different items in the helpers menu.
  const menuNames = {
    "main" : 'Create new item' 
  };
  const {view, direction, goToView, goToPreviousView} = MenuViews("main", setMenuName, menuNames);

  let helpers = {};
  // Add here all the new helpers.
  [FoodHelper, CustomHelper].forEach((helper) => {
    const [id, name, icon, getJSX, prevViewFunc, getCurrentMenuName] = helper({
      storageUnits        : storageUnits,
      metaKeys            : metaKeys,
      validationFunction  : validationFunction,
      setMenuName         : setMenuName,
      handleSaveNewItem   : handleSave
    });
    helpers[id] = {name, icon, getJSX, prevViewFunc, getCurrentMenuName};
  })

  function goBack() {
    if(helperID !== null) {
      // Try to go back on the current helper.
      const canGoBack = helpers[helperID].prevViewFunc();
      if(!canGoBack) {
        setHelperId(null);
        goToPreviousView();
      }
    }else {
      // Try to go back on the helpers menu.
      const canGoBack = goToPreviousView();
      if(!canGoBack) onClose();
    }
  }

  function selectHelperMenu(newHelperID) {
    if(!(newHelperID in helpers)) return;

    goToView(helpers[newHelperID].name);
    // Only set the name on the transition from HelpersMenu to Menu. 
    // The helper will take care of this when it is selected.
    setMenuName(helpers[newHelperID].getCurrentMenuName())

    setHelperId(newHelperID);
  }

  function handleSave({name, storageId, qty, meta}) {
    const formErr = validationFunction(name, Number(qty), storageId, meta) || {};
    if(Object.keys(formErr).length === 0){
      onSave({ 
        name: name.trim(), 
        qty: Number(qty), 
        storageUnitId: storageId || null, 
        meta 
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-3xl max-h-full min-h-[40vh] overflow-y-auto overflow-x-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          {helperID !== null && <button onClick={goBack} className="p-2 rounded-md mr-2"><ChevronLeft /></button>} 
          <h3 className="text-xl font-semibold">{menuName}</h3>
          <button onClick={onClose} className="p-2 rounded-md ml-auto"><XIcon /></button>
        </div>

        <AnimatePresence mode="wait">
          {helperID === null && (
            <AnimatedMenuDiv keyName="main" direction={direction}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
                {Object.entries(helpers).map(([key, value]) => 
                    <button key={key} className={buttonClass} onClick={() => selectHelperMenu(key)}>
                      {value.icon}
                      <div className="text-sm font-medium text-center mt-1">{value.name}</div>
                    </button>
                )}
              </div>
            </AnimatedMenuDiv>
          )}

          {helperID !== null && (
            <AnimatedMenuDiv keyName={helperID} direction={direction}>
              {helpers[helperID].getJSX()}
            </AnimatedMenuDiv>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
