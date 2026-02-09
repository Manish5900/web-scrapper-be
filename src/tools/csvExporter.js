import { Parser } from "json2csv";
import fs from "fs";

export function exportCSV(data, filename) {
  const parser = new Parser();
  const csv = parser.parse(data);
  fs.writeFileSync(`${filename}.csv`, csv);
}
