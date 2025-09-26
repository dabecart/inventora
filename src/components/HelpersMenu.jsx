import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XIcon, ChevronLeft} from "lucide-react";
import MenuViews from "../utils/MenuViews";

import FoodHelper from "./helpers/FoodHelper";

export default function HelpersMenu({ onSave, onClose, storageUnits, metaKeys, validationFunction, handleCreateItem}) {
  const buttonClass = "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl shadow-md w-full h-full bg-gray-800 border hover:shadow-lg";

  // Stores the selected helper and its information.
  const [helperID, setHelperId] = useState(null);

  // Name at the top of the menu.
  const [menuName, setMenuName] = useState('Create new item');
  useEffect(() => { helperID === null && setMenuName('Create new item') }, [helperID]);

  // Properties of the new item.
  const [name, setName] = useState('');
  const [qty, setQty] = useState(0);
  const [storageId, setStorageId] = useState('');
  const [meta, setMeta] = useState({ ...({}) });

  const errors = validationFunction(name, Number(qty), storageId, meta) || {};
  const hasErrors = Object.keys(errors).length > 0;

  let helpers = {};
  // Add here all the new helpers.
  [FoodHelper, ].forEach((helper) => {
    const [id, name, icon, getJSX, setActive, prevViewFunc] = helper({
      storageUnits: storageUnits,
      setMenuName : setMenuName
    });
    helpers[id] = {name, icon, getJSX, setActive, prevViewFunc};
  })

  function goBack() {
    if(helperID !== null) {
      // Try to go back on the current helper.
      const canGoBack = helpers[helperID].prevViewFunc();
      if(!canGoBack) {
        helpers[helperID].setActive(false);
        setHelperId(null);
      }
    }else {
      onClose();
    }
  }

  function selectHelperMenu(newHelperID) {
    if(!(newHelperID in helpers)) return;

    helpers[newHelperID].setActive(true);

    setHelperId(newHelperID);
  }

  function handleSave() {
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
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-3xl">
        <div className="flex justify-between items-center mb-4">
          {helperID !== null && <button onClick={goBack} className="p-2 rounded-md mr-2"><ChevronLeft /></button>} 
          <h3 className="text-xl font-semibold">{menuName}</h3>
          <button onClick={onClose} className="p-2 rounded-md ml-auto"><XIcon /></button>
        </div>

        <AnimatePresence mode="wait">
          {helperID === null && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
                {Object.entries(helpers).map(([key, value]) => 
                    <button key={key} className={buttonClass} onClick={() => selectHelperMenu(key)}>
                      {value.icon}
                      <div className="text-sm font-medium text-center mt-1">{value.name}</div>
                    </button>
                )}
              </div>
            </motion.div>
          )}

            {helperID !== null && (
            <motion.div
              key={helperID}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              {helpers[helperID].getJSX()}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
