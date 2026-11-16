"use strict";

function mergePersonalizerSave(before, current, saved) {
  const result = { ...saved };
  for (const key of Object.keys(current || {})) {
    if (JSON.stringify(current[key]) !== JSON.stringify(before?.[key])) {
      result[key] = current[key];
    }
  }
  return result;
}

module.exports = { mergePersonalizerSave };
