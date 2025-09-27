import { useState, useEffect } from "react";
import MenuViews from "../../utils/MenuViews";
import { LayoutTemplate } from "lucide-react";
import { setKeyValue } from "../MetaEditor";
import ItemResume from "../ItemResume";

export default function HelperTemplate({ storageUnits = [], metaKeys = [], validationFunction, setMenuName, handleSaveNewItem }) {
  // Template constants.
  const HELPER_ID   = "Template";
  const HELPER_NAME = "Template Helper"
  const HELPER_ICON = <LayoutTemplate size={36} />;
  
  // Properties of the new item.
  const [name, setName] = useState('');
  const [storageId, setStorageId] = useState(null);
  const [qty, setQty] = useState(1);
  const [meta, setMeta] = useState({});
  const errors = validationFunction(name, Number(qty), storageId, meta) || {};
  const hasErrors = Object.keys(errors).length > 0;
  function setMetaValue(key, value) { setKeyValue(key, value, setMeta); }

  // "1st view" | "2nd view" ...
  // Use goToView to change the current view.
  const {view, goToView, goToPreviousView} = MenuViews("1st view");
  // True if the current helper is active.
  const [isActive, setActive] = useState(false);
  
  // Full names of every possible view.
  const menuNames = {
    "1st view" : "1st view menu",
    "2nd view" : "2nd view menu",
  }

  // Automatically updates the menu name.
  useEffect(() => {
    if(!isActive) return;
    setMenuName(menuNames[view]);
  }, [isActive, view]);

  // Gets called when the current helper is selected.
  function getJSX() {
    return (


      // Always add a resume in the final view of the helper.
      <div className="flex flex-col flex-gap-1">
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
        <div className="flex justify-end gap-2 mt-6">
          <button 
            onClick={() => handleSaveNewItem({name, storageId, qty, meta})} 
            disabled={hasErrors}
            className={`px-4 py-2 rounded ${hasErrors ? 'bg-gray-400 text-gray-700' : 'bg-blue-600 text-white'}`}>
              Add item
          </button>
        </div>
      </div>
    );
  }

  return [HELPER_ID, HELPER_NAME, HELPER_ICON, getJSX, setActive, goToPreviousView];
}
