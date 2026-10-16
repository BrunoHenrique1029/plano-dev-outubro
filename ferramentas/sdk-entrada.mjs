// Entrada para gerar js/vendor/anthropic-sdk.js (comando: npm run vendor).
// A página não usa módulos, então a biblioteca vira uma variável global: window.Anthropic.
import Anthropic from "@anthropic-ai/sdk";

window.Anthropic = Anthropic;
