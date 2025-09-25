import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Cpu, Plus , XIcon, ChevronLeft} from "lucide-react";

import ElectronicsHelper from "./helpers/ElectronicsHelper";
import FoodHelper from "./helpers/FoodHelper";
import ManualHelper from "./helpers/ManualHelper";

export default function HelpersMenu({ onSave, onClose, storageUnits, metaKeys, validationFunction, handleCreateItem}) {
  const buttonClass = "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl shadow-md w-full h-full bg-gray-800 border hover:shadow-lg";
  const [view, setView] = React.useState("menu"); // "menu" | "food" | "electronics" | "manual"
  const [previousState, setPreviousState] = useState([]);

  const [name, setName] = useState('');
  const [qty, setQty] = useState(0);
  const [storageId, setStorageId] = useState('');
  const [meta, setMeta] = useState({ ...({}) });

  const errors = validationFunction(name, Number(qty), storageId, meta) || {};
  const hasErrors = Object.keys(errors).length > 0;

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

  const menuNames = {
    "menu"        : "Create new item",
    "food"        : "Create new food item",
    "electronics" : "Create new electronics item",
    "manual"      : "Create new custom item"
  }

  function backToMenu() {
    setView("menu");
  }

  function goToState(newState) {
    setPreviousState(s => [...s, view]);
    setView(newState);
  }

  function goToPreviousState() {
    if(previousState.length === 0) {
      onClose();
    }else {
      setView(previousState[previousState.length - 1]);
      setPreviousState(previousState => previousState.slice(0, previousState.length - 1));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-3xl">
        <div className="flex justify-between items-center mb-4">
          <button onClick={goToPreviousState} className="p-2 rounded-md mr-2"><ChevronLeft /></button>
          <h3 className="text-xl font-semibold">{menuNames[view]}</h3>
          <button onClick={onClose} className="p-2 rounded-md ml-auto"><XIcon /></button>
        </div>

        <AnimatePresence mode="wait">
          {view === "menu" && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
                <button className={buttonClass} onClick={() => goToState('food')}>
                  <ShoppingCart size={36} />
                  <div className="text-sm font-medium text-center mt-1">Food helper</div>
                </button>

                <button className={buttonClass} onClick={() => goToState('electronics')}>
                  <Cpu size={36} />
                  <div className="text-sm font-medium text-center mt-1">Electronics helper</div>
                </button>

                <button className={buttonClass} onClick={() => goToState('manual')}>
                  <Plus size={36} />
                  <div className="text-sm font-medium text-center mt-1">Manual add</div>
                </button>
              </div>
            </motion.div>
          )}

          {view === "food" && (
            <motion.div
              key="food"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              <FoodHelper
                storageUnits={storageUnits.units}
                onBack={backToMenu}
                openEditModal={(prefill) => {
                  // TODO: pass data to the manual menu.
                  setView("manual");
                }}
              />
            </motion.div>
          )}

          {view === "electronics" && (
            <motion.div
              key="electronics"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              <ElectronicsHelper
                storageUnits={storageUnits.units}
                onBack={backToMenu}
                openEditModal={(prefill) => {
                  // TODO: pass data to the manual menu.
                  setView("manual");
                }}
              />
            </motion.div>
          )}

          {view === "manual" && (
            <motion.div
              key="manual"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              <ManualHelper
                storageUnits={storageUnits} 
                metaKeys={metaKeys} 
                name={name} 
                setName={setName} 
                qty={qty} 
                setQty={setQty} 
                storageId={storageId} 
                setStorageId={setStorageId} 
                meta={meta} 
                setMeta={setMeta} 
                errors={errors}
              ></ManualHelper>

              <div className="flex justify-end gap-2 mt-6">
                <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200 text-gray-700">Discard</button>
                <button onClick={handleSave} disabled={hasErrors} className={`px-4 py-2 rounded ${hasErrors ? 'bg-gray-400 text-gray-700' : 'bg-blue-600 text-white'}`}>Save</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
