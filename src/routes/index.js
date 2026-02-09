export default configRoutes((app) => {
  app.get("/invoice/:id/pdf", async (req, res) => {
    // const invoice = await getInvoiceFromDB(req.params.id);
    const invoice = {
      number: "INV-1001",
      date: "22 Jan 2026",
      company: {
        name: "SwiftSupport AI",
        address: "Bangalore, India",
      },
      customer: {
        name: "Manish Singh",
        email: "manish@gmail.com",
      },
      items: [
        { name: "Pro Subscription", qty: 1, price: 999 },
        { name: "Support Add-on", qty: 1, price: 499 },
      ],
      total: 1498,
    };

    const pdf = await generateInvoicePDF(invoice);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=invoice-${invoice.number}.pdf`,
    });

    res.send(pdf);
  });
});
