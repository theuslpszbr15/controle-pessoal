import { state } from './store.js';
import { cssVar } from './utils.js';
import { shared } from './shared.js';

export const TEMAS = [
  { id: 'ametista', nome: 'Ametista', desc: 'Roxo profundo e noturno', emoji: '🔮', frase: 'Uma noite tranquila de foco' },
  { id: 'lavanda', nome: 'Lavanda', desc: 'Roxo claro e suave', emoji: '💜', frase: 'Leve como um campo de lavanda' },
  { id: 'oceano', nome: 'Oceano', desc: 'Azul com ondas', emoji: '🌊', frase: 'Maré calma, mente clara' },
  { id: 'floresta', nome: 'Floresta', desc: 'Verde musgo e curvas de nível', emoji: '🌲', frase: 'Passo a passo pela trilha' },
  { id: 'terracota', nome: 'Terracota', desc: 'Quente e terroso', emoji: '🏺', frase: 'Construindo o dia com as mãos' },
  { id: 'papel', nome: 'Papel', desc: 'Minimalista, tinta sobre papel', emoji: '📜', frase: 'Uma página em branco para hoje' },
  { id: 'grafite', nome: 'Grafite', desc: 'Monocromático escuro', emoji: '✏️', frase: 'Simples, direto, sem ruído' },
  { id: 'sakura', nome: 'Sakura', desc: 'Rosa de cerejeira', emoji: '🌸', frase: 'Pequenas flores, grandes hábitos' },
  { id: 'meia-noite', nome: 'Meia-noite', desc: 'Azul-marinho e dourado', emoji: '🌙', frase: 'Estrelas alinhadas para hoje' },
  { id: 'cafe', nome: 'Café', desc: 'Marrom aconchegante', emoji: '☕', frase: 'Um café e uma lista de tarefas' },
];

export const temaAtual = () => TEMAS.find((t) => t.id === state.settings.tema) || TEMAS[0];

export function applyTheme(id, animate = true) {
  const tema = TEMAS.find((t) => t.id === id) || TEMAS[0];
  document.body.dataset.theme = tema.id;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', cssVar('--bg'));
  shared.bg?.readTheme(animate);
  shared.router?.onTheme();
  return tema;
}
