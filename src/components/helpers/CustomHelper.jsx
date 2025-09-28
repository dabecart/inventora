import { useState, useEffect } from "react";
import MenuViews from "../../utils/MenuViews";
import { Plus } from "lucide-react";
import ItemResume from "../ItemResume";
import AnimatedMenuDiv from "../AnimatedMenuDiv";

export default function CustomHelper({ storageUnits = [], metaKeys = [], validationFunction, setMenuName, handleSaveNewItem }) {
  // Template constants.
  const HELPER_ID   = "Custom";
  const HELPER_NAME = "Custom Helper"
  const HELPER_ICON = <Plus size={36} />;
  
  // Properties of the new item.
  const [name, setName] = useState('');
  const [storageId, setStorageId] = useState(null);
  const [qty, setQty] = useState(1);
  const [meta, setMeta] = useState({});
  const errors = validationFunction(name, Number(qty), storageId, meta) || {};
  const hasErrors = Object.keys(errors).length > 0;

  // Use goToView to change the current view.
  const menuNames = {
    "Resume" : "New custom item",
  }
  const {view, direction, goToView, goToPreviousView, getCurrentMenuName} = MenuViews("Resume", setMenuName, menuNames);
  
  // Gets called when the current helper is selected.
  function getJSX() {
    return (
      <AnimatedMenuDiv keyName="custom-resume" direction={direction}>
        <ItemResume
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
        />
        <div className="flex justify-end gap-2 mt-4">
          <button 
            onClick={() => handleSaveNewItem({name, storageId, qty, meta})} 
            disabled={hasErrors}
            className={`px-4 py-2 rounded ${hasErrors ? 'bg-gray-400 text-gray-700' : 'bg-blue-600 text-white'}`}>
              Add item
          </button>
        </div>
      </AnimatedMenuDiv>
    );
  }

  return [HELPER_ID, HELPER_NAME, HELPER_ICON, getJSX, goToPreviousView, getCurrentMenuName];
}
