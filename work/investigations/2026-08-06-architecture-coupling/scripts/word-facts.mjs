import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const core = JSON.parse(fs.readFileSync(`${root}/extension/data/dict-core.json`, 'utf8'));
const forms = JSON.parse(fs.readFileSync(`${root}/extension/data/forms.json`, 'utf8'));
const bands = JSON.parse(fs.readFileSync(`${root}/extension/data/frequency-bands.json`, 'utf8'));
const words = ['evaluating','improving','building','collecting','requires','published','environments','reinforcement','inference','framework','storing','drafted','reaches','customer'];
const lookup = (surface) => {
  const form = surface.toLowerCase();
  if (core[form]) return {kind:'core', wordKey:form, entry:core[form], band:bands[form] ?? 9};
  const mapped = forms[form];
  if (mapped && core[mapped]) return {kind:'forms', wordKey:mapped, entry:core[mapped], band:bands[mapped] ?? 9};
  return null;
};
console.log(JSON.stringify({counts:{core:Object.keys(core).length,forms:Object.keys(forms).length,bands:Object.keys(bands).length},facts:words.map(surfaceForm=>({surfaceForm,scannerExtracted:/^[a-zA-Z]+(?:[''-][a-zA-Z]+)*$/.test(surfaceForm),coreHit:!!core[surfaceForm],formsTarget:forms[surfaceForm]??null,lookup:lookup(surfaceForm)}))},null,2));
