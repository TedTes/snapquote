import type { PainterChecklist } from "../../src/index.js";

export type PainterAccuracyFixture = {
  name: string;
  checklist: PainterChecklist;
  notes: string;
  expected: Array<{
    key: string;
    quantity: number;
    state: "green" | "yellow" | "red";
  }>;
};

const emptyChecklist: PainterChecklist = {
  rooms: { small: 0, medium: 0, large: 0 },
  surfaces: { walls: false, ceilings: false, trim: false },
  doorCount: 0,
  prepLevel: "normal",
  coatCount: 2,
  customerSuppliesPaint: true
};

export const painterAccuracyFixtures: PainterAccuracyFixture[] = [
  {
    name: "two medium rooms with walls",
    checklist: {
      ...emptyChecklist,
      rooms: { small: 0, medium: 2, large: 0 },
      surfaces: { walls: true, ceilings: false, trim: false }
    },
    notes: "",
    expected: [{ key: "paint_walls", quantity: 2, state: "green" }]
  },
  {
    name: "one small room with walls and ceiling",
    checklist: {
      ...emptyChecklist,
      rooms: { small: 1, medium: 0, large: 0 },
      surfaces: { walls: true, ceilings: true, trim: false }
    },
    notes: "",
    expected: [
      { key: "paint_walls", quantity: 1, state: "green" },
      { key: "paint_ceiling", quantity: 1, state: "green" }
    ]
  },
  {
    name: "one large room with trim",
    checklist: {
      ...emptyChecklist,
      rooms: { small: 0, medium: 0, large: 1 },
      surfaces: { walls: false, ceilings: false, trim: true }
    },
    notes: "",
    expected: [{ key: "paint_trim", quantity: 1, state: "green" }]
  },
  {
    name: "three doors",
    checklist: { ...emptyChecklist, doorCount: 3 },
    notes: "",
    expected: [{ key: "paint_door", quantity: 3, state: "green" }]
  },
  {
    name: "heavy wall preparation",
    checklist: { ...emptyChecklist, prepLevel: "heavy" },
    notes: "",
    expected: [{ key: "heavy_wall_prep", quantity: 1, state: "green" }]
  },
  {
    name: "patch nail holes in two rooms",
    checklist: {
      ...emptyChecklist,
      rooms: { small: 0, medium: 2, large: 0 },
      surfaces: { walls: true, ceilings: false, trim: false }
    },
    notes: "Please patch the nail holes before painting.",
    expected: [
      { key: "paint_walls", quantity: 2, state: "green" },
      { key: "patch_nail_holes", quantity: 2, state: "yellow" }
    ]
  },
  {
    name: "primer in one small room",
    checklist: {
      ...emptyChecklist,
      rooms: { small: 1, medium: 0, large: 0 },
      surfaces: { walls: true, ceilings: false, trim: false }
    },
    notes: "Prime the walls first.",
    expected: [
      { key: "paint_walls", quantity: 1, state: "green" },
      { key: "primer_coat", quantity: 1, state: "yellow" }
    ]
  },
  {
    name: "wallpaper removal needs pricing",
    checklist: {
      ...emptyChecklist,
      rooms: { small: 0, medium: 1, large: 0 },
      surfaces: { walls: true, ceilings: false, trim: false }
    },
    notes: "Remove the wallpaper before painting.",
    expected: [
      { key: "paint_walls", quantity: 1, state: "green" },
      { key: "remove_wallpaper", quantity: 1, state: "red" }
    ]
  },
  {
    name: "mixed room sizes preserve separate rates",
    checklist: {
      ...emptyChecklist,
      rooms: { small: 1, medium: 1, large: 1 },
      surfaces: { walls: true, ceilings: false, trim: false }
    },
    notes: "",
    expected: [
      { key: "paint_walls", quantity: 1, state: "green" },
      { key: "paint_walls", quantity: 1, state: "green" },
      { key: "paint_walls", quantity: 1, state: "green" }
    ]
  },
  {
    name: "full interior request",
    checklist: {
      ...emptyChecklist,
      rooms: { small: 0, medium: 2, large: 0 },
      surfaces: { walls: true, ceilings: true, trim: true },
      doorCount: 2
    },
    notes: "Patch nail holes and apply primer where needed.",
    expected: [
      { key: "paint_walls", quantity: 2, state: "green" },
      { key: "paint_ceiling", quantity: 2, state: "green" },
      { key: "paint_trim", quantity: 2, state: "green" },
      { key: "paint_door", quantity: 2, state: "green" },
      { key: "patch_nail_holes", quantity: 2, state: "yellow" },
      { key: "primer_coat", quantity: 2, state: "yellow" }
    ]
  }
];
