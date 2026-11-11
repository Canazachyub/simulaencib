/** Imágenes 3D generadas para la plataforma (public/images). */
const base = import.meta.env.BASE_URL;

export const examImg = (examId: string) => `${base}images/examenes/${examId}.webp`;

export type Pose = 'celebra' | 'piensa' | 'anima';
export const mascota = (pose: Pose) => `${base}images/mascota/${pose}.webp`;

/** Ícono de área según el nombre del curso (sin tildes, por palabras clave). */
const AREAS: Array<[RegExp, string]> = [
  [/gineco|obstetr|ginecol|utero|parto|gestan/, 'gineco'],
  [/pediatr|neonat|recien nacido|nino|adolesc/, 'pediatria'],
  [/emergenc|urgenc|critico|uci|toxicol|trauma(?!tologia)/, 'emergencias'],
  [/cirug|traumatolog|\burolog|oftalmol|otorrino|neurocirug|quemad|anestes/, 'cirugia'],
  [/etica|interculturalidad|legal/, 'etica'],
  [/investigacion|bioestad|estadistic|gestion|gerencia/, 'investigacion'],
  [/salud publica|comunitaria|epidemiol|cuidado integral|prevencion|promocion/, 'salud-publica'],
  [/anatom|embriol|histol|bioquim|fisiol|farmacol|microbiol|parasitol|patolog|inmunol|genetica|ciencias basicas|morfolog|dinamicas/, 'ciencias-basicas'],
];

export function areaImg(courseName: string): string {
  const k = courseName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const hit = AREAS.find(([re]) => re.test(k));
  return `${base}images/areas/${hit ? hit[1] : 'medicina'}.webp`;
}
