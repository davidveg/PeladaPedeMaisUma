import type { SeasonPassportStamp } from "@/types";

export const passportResultPalette: Record<SeasonPassportStamp["result"], {
  backgroundColor: string;
  borderColor: string;
  badgeBackgroundColor: string;
  textColor: string;
}> = {
  WIN: { backgroundColor: "#EAF7EF", borderColor: "#72B991", badgeBackgroundColor: "#D3EFDE", textColor: "#176A40" },
  LOSS: { backgroundColor: "#FFF0EE", borderColor: "#D98D84", badgeBackgroundColor: "#FAD9D5", textColor: "#A83229" },
  DRAW: { backgroundColor: "#FFF8DF", borderColor: "#D7B952", badgeBackgroundColor: "#F7E8AD", textColor: "#7D5B00" },
  ABSENT: { backgroundColor: "#F1F4F2", borderColor: "#AEB9B3", badgeBackgroundColor: "#E1E7E3", textColor: "#5F6D65" },
};
