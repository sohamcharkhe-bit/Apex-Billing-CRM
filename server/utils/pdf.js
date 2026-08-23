const PDFDocument = require('pdfkit');
const config = require('../config/config');
const { formatRupee, formatNumber } = require('./money');
const { normalizeIndianPhone } = require('./phone');

/**
 * Generates a branded PDF for an invoice.
 * Returns a Promise resolving to a Buffer.
 */
function generateInvoicePDF(invoice, items = [], payments = []) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Palette constants
      const primaryColor = '#1C1F26';
      const accentColor = '#4F46E5';
      const mutedColor = '#64748B';
      const borderColor = '#E2E8F0';

      // Header: Brand & Company Info
      doc.rect(40, 40, 515, 80).fill('#F8FAFC');
      
      doc.fillColor('#0F172A')
         .fontSize(22)
         .font('Helvetica-Bold')
         .text(config.brand.name.toUpperCase(), 55, 52);

      doc.fillColor(mutedColor)
         .fontSize(8)
         .font('Helvetica')
         .text(config.brand.company.address, 55, 78)
         .text(`Phone: ${config.brand.company.phone} | Email: ${config.brand.company.email}`, 55, 90)
         .text(`GSTIN: ${config.brand.company.gstin}`, 55, 102);

      // Invoice Badge / Title right side
      doc.fillColor(accentColor)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('TAX INVOICE', 400, 55, { align: 'right', width: 140 });

      doc.fillColor('#0F172A')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(invoice.invoice_number, 400, 75, { align: 'right', width: 140 });

      const statusText = (invoice.status || 'draft').toUpperCase();
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(invoice.status === 'paid' ? '#059669' : (invoice.status === 'overdue' ? '#D97706' : '#475569'))
         .text(`STATUS: ${statusText}`, 400, 92, { align: 'right', width: 140 });

      // Invoice & Customer Info Grid
      let y = 135;
      
      // Bill To Box (Left)
      doc.fillColor(mutedColor).fontSize(8).font('Helvetica-Bold').text('BILLED TO:', 45, y);
      doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text(invoice.customer_name, 45, y + 14);
      
      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      let custY = y + 28;
      if (invoice.company) {
        doc.text(invoice.company, 45, custY);
        custY += 12;
      }
      if (invoice.customer_email) {
        doc.text(invoice.customer_email, 45, custY);
        custY += 12;
      }
      if (invoice.customer_phone) {
        doc.text(normalizeIndianPhone(invoice.customer_phone), 45, custY);
        custY += 12;
      }
      if (invoice.billing_address) {
        doc.text(invoice.billing_address, 45, custY, { width: 220 });
      }

      // Invoice Meta Details (Right)
      const metaX = 350;
      doc.fillColor(mutedColor).fontSize(8).font('Helvetica-Bold').text('INVOICE DETAILS:', metaX, y);
      
      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      doc.text(`Issue Date: ${invoice.issue_date}`, metaX, y + 14);
      doc.text(`Due Date: ${invoice.due_date}`, metaX, y + 28);
      const termsLabel = invoice.payment_terms === 'full' ? 'Full Payment' : 'Due / Credit';
      doc.text(`Payment Terms: ${termsLabel}`, metaX, y + 42);

      // Table Header
      y = Math.max(custY + 30, y + 75);
      doc.rect(40, y, 515, 22).fill('#1E293B');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
      doc.text('#', 48, y + 6);
      doc.text('DESCRIPTION', 70, y + 6);
      doc.text('QTY', 300, y + 6, { align: 'right', width: 40 });
      doc.text('UNIT PRICE', 350, y + 6, { align: 'right', width: 65 });
      doc.text('TAX', 425, y + 6, { align: 'right', width: 40 });
      doc.text('TOTAL', 475, y + 6, { align: 'right', width: 70 });

      y += 24;

      // Table Rows
      doc.font('Helvetica').fontSize(8.5);
      items.forEach((item, index) => {
        const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(40, y, 515, 20).fill(rowBg);
        
        doc.fillColor('#0F172A')
           .text(String(index + 1), 48, y + 5)
           .text(item.description, 70, y + 5, { width: 220, ellipsis: true })
           .text(formatNumber(item.quantity), 300, y + 5, { align: 'right', width: 40 })
           .text(formatRupee(item.unit_price), 350, y + 5, { align: 'right', width: 65 })
           .text(formatNumber(item.tax_rate, true), 425, y + 5, { align: 'right', width: 40 })
           .text(formatRupee(item.line_total), 475, y + 5, { align: 'right', width: 70 });

        y += 20;
      });

      // Line border under items table
      doc.rect(40, y, 515, 1).fill(borderColor);
      y += 12;

      // Totals Box (Right Aligned)
      const totX = 340;
      const valX = 450;
      const totW = 100;

      doc.font('Helvetica').fontSize(9).fillColor('#475569');
      doc.text('Subtotal:', totX, y);
      doc.text(formatRupee(invoice.subtotal), valX, y, { align: 'right', width: 95 });
      y += 15;

      doc.text('Tax Total:', totX, y);
      doc.text(formatRupee(invoice.tax_total), valX, y, { align: 'right', width: 95 });
      y += 15;

      if (Number(invoice.discount_total) > 0) {
        doc.text('Discount:', totX, y);
        doc.text(`- ${formatRupee(invoice.discount_total)}`, valX, y, { align: 'right', width: 95 });
        y += 15;
      }

      // Grand Total Highlight
      doc.rect(totX - 10, y - 2, 225, 24).fill('#EEF2FF');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#312E81');
      doc.text('Grand Total:', totX, y + 4);
      doc.text(formatRupee(invoice.grand_total), valX, y + 4, { align: 'right', width: 95 });
      y += 30;

      // Payments & Balance summary
      const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const balanceDue = Math.max(0, Number(invoice.grand_total) - totalPaid);

      doc.font('Helvetica').fontSize(9).fillColor('#475569');
      doc.text('Total Paid:', totX, y);
      doc.text(formatRupee(totalPaid), valX, y, { align: 'right', width: 95 });
      y += 15;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(balanceDue > 0 ? '#DC2626' : '#059669');
      doc.text('Balance Due:', totX, y);
      doc.text(formatRupee(balanceDue), valX, y, { align: 'right', width: 95 });
      y += 25;

      // Notes & Payment instructions
      if (invoice.notes) {
        doc.rect(40, y, 515, 45).fill('#F8FAFC');
        doc.fillColor(mutedColor).font('Helvetica-Bold').fontSize(8).text('NOTES & TERMS:', 50, y + 8);
        doc.fillColor('#334155').font('Helvetica').fontSize(8.5).text(invoice.notes, 50, y + 20, { width: 495 });
        y += 55;
      }

      // Footer
      doc.fillColor(mutedColor)
         .fontSize(8)
         .font('Helvetica')
         .text('Thank you for your business! For any billing queries, contact support@apexbilling.com', 40, 780, {
           align: 'center',
           width: 515
         });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateInvoicePDF
};
