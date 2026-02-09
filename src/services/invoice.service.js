import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

export function generateInvoiceHTML(invoice) {
  const templatePath = path.join(
    process.cwd(),
    "/src/templates/invoice.template.html",
  );
  console.log("templatePath", templatePath);

  let html = fs.readFileSync(templatePath, "utf8");

  const itemsHTML = invoice.items
    .map(
      (item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.qty}</td>
        <td>₹${item.price}</td>
        <td>₹${item.qty * item.price}</td>
      </tr>`,
    )
    .join("");

  html = html
    .replace("{{invoiceNumber}}", invoice.number)
    .replace("{{date}}", invoice.date)
    .replace("{{companyName}}", invoice.company.name)
    .replace("{{companyAddress}}", invoice.company.address)
    .replace("{{customerName}}", invoice.customer.name)
    .replace("{{customerEmail}}", invoice.customer.email)
    .replace("{{items}}", itemsHTML)
    .replace("{{total}}", invoice.total);

  return html;
}

export async function generateInvoicePDF(invoice) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  const html = generateInvoiceHTML(invoice);
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "20mm",
      bottom: "20mm",
      left: "15mm",
      right: "15mm",
    },
  });

  await browser.close();
  return pdfBuffer;
}
