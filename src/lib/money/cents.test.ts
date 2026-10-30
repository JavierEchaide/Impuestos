import { describe, expect, it } from "vitest";
import {
  bpToInput,
  centiSharesToInput,
  centsToInput,
  formatEuros,
  formatSignedEuros,
  parseEuros,
  parsePercentToBp,
  parseSharesToCenti,
} from "./cents";

describe("parseEuros", () => {
  it.each([
    ["12", 1200],
    ["12,5", 1250],
    ["12,50", 1250],
    ["12.50", 1250],
    ["12.5", 1250],
    ["0,05", 5],
    [",5", 50],
    ["1.234,56", 123456],
    ["1.234", 123400],
    ["1.234.567", 123456700],
    ["  25,00 € ", 2500],
    ["0", 0],
  ])("%s -> %i céntimos", (input, expected) => {
    expect(parseEuros(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "+5", "12,345", "1,2,3", "1.2.3,4,5", "€"])(
    "rechaza %j",
    (input) => {
      expect(parseEuros(input)).toBeNull();
    },
  );

  it("no usa floats: 0,29 son 29 céntimos exactos", () => {
    expect(parseEuros("0,29")).toBe(29);
    expect(parseEuros("1,15")).toBe(115);
    expect(parseEuros("4,35")).toBe(435);
  });
});

describe("formato", () => {
  it("formatEuros usa es-ES con coma decimal", () => {
    expect(formatEuros(1250).replace(/ /g, " ")).toBe("12,50 €");
    expect(formatEuros(0).replace(/ /g, " ")).toBe("0,00 €");
  });

  it("formatSignedEuros añade signo salvo en cero", () => {
    expect(formatSignedEuros(450).replace(/ /g, " ")).toBe("+4,50 €");
    expect(formatSignedEuros(-450).replace(/ /g, " ")).toBe("-4,50 €");
    expect(formatSignedEuros(0).replace(/ /g, " ")).toBe("0,00 €");
  });

  it("centsToInput es el inverso de parseEuros", () => {
    for (const cents of [0, 5, 99, 100, 1250, 123456]) {
      expect(parseEuros(centsToInput(cents))).toBe(cents);
    }
  });
});

describe("porcentajes y participaciones", () => {
  it("parsea porcentajes con dos decimales", () => {
    expect(parsePercentToBp("33,33")).toBe(3333);
    expect(parsePercentToBp("50")).toBe(5000);
    expect(parsePercentToBp("100 %")).toBe(10000);
    expect(parsePercentToBp("12,345")).toBeNull();
    expect(bpToInput(3333)).toBe("33,33");
  });

  it("parsea participaciones decimales", () => {
    expect(parseSharesToCenti("1,5")).toBe(150);
    expect(parseSharesToCenti("2")).toBe(200);
    expect(centiSharesToInput(150)).toBe("1,5");
    expect(centiSharesToInput(200)).toBe("2");
    expect(centiSharesToInput(25)).toBe("0,25");
  });
});
