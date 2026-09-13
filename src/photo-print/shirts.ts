export type ShirtPreset = {
  id: string;
  label: string;
  group: "Male" | "Female";
  src: string;
};

export const SHIRT_PRESETS: ShirtPreset[] = [
  {
    id: "male-white-shirt",
    label: "White shirt",
    group: "Male",
    src: "/overlays/shirts/male-white-shirt.svg",
  },
  {
    id: "male-navy-suit",
    label: "Navy suit",
    group: "Male",
    src: "/overlays/shirts/male-navy-suit.svg",
  },
  {
    id: "female-white-blouse",
    label: "White blouse",
    group: "Female",
    src: "/overlays/shirts/female-white-blouse.svg",
  },
  {
    id: "female-navy-blazer",
    label: "Navy blazer",
    group: "Female",
    src: "/overlays/shirts/female-navy-blazer.svg",
  },
];
