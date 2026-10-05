import jsPDF from 'jspdf';

export const generateHandbookPDF = async (setNotification?: (notif: { message: string; type: 'success' | 'info' | 'error' | 'warning' }) => void) => {
  if (setNotification) {
    setNotification({ message: 'Compiling Comprehensive Estimating Handbook...', type: 'info' });
  }

  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    const today = new Date().toLocaleDateString('en-GB');

    // Helper: Draw Left Border on Pages 2-4
    const drawPageLeftAccent = (doc: jsPDF) => {
      doc.setFillColor(234, 88, 12); // Orange: #ea580c
      doc.rect(0, 0, 4, 297, 'F');
      
      doc.setFillColor(15, 23, 42); // Navy Dark
      doc.rect(4, 0, 2, 297, 'F');
    };

    // Helper: Draw Header on Pages 2-4
    const drawPageHeader = (doc: jsPDF, chapterTitle: string, pageNumStr: string) => {
      drawPageLeftAccent(doc);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(234, 88, 12); // Orange
      doc.text(chapterTitle.toUpperCase(), 20, 15);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // Slate grey
      doc.text("COST ENGINE WORKSTATION HANDBOOK", 115, 15);
      
      doc.setDrawColor(226, 232, 240); // Light gray border line
      doc.line(20, 18, 190, 18);
    };

    // Helper: Draw Footer on Pages 2-4
    const drawPageFooter = (doc: jsPDF, currentPage: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.line(20, 278, 190, 278);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`PAGE ${currentPage} OF 4`, 20, 284);

      doc.setFont('helvetica', 'normal');
      doc.text("RELEASED - VERIFIED (v2.8.4)", 85, 284);
      doc.text(`COMPILED ON ${today}`, 155, 284);
    };

    // Helper: Custom wrapped text drawer returning final Y
    const drawWrappedText = (doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number = 4.8): number => {
      const lines = doc.splitTextToSize(text, maxWidth);
      for (let i = 0; i < lines.length; i++) {
        doc.text(lines[i], x, y + i * lineHeight);
      }
      return y + (lines.length * lineHeight);
    };

    // Helper: Draw styled formula boxes
    const drawFormulaBox = (doc: jsPDF, y: number, expressions: { label: string; formula: string }[]) => {
      // Dark slate background
      doc.setFillColor(15, 23, 42); // #0f172a
      const boxHeight = (expressions.length * 15) + 6;
      doc.roundedRect(20, y, 170, boxHeight, 3, 3, 'F');

      let currentInnerY = y + 7;
      expressions.forEach((item) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(203, 213, 225); // Slate
        doc.text(item.label, 26, currentInnerY);

        doc.setFont('courier', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(251, 146, 60); // Orange tint (#fb923c)
        doc.text(item.formula, 26, currentInnerY + 5.5);
        
        currentInnerY += 15;
      });

      return y + boxHeight + 4;
    };


    // ================= PAGE 1: COVER PAGE =================
    // Thick full height sidebar on cover page
    doc.setFillColor(234, 88, 12); // Orange: #ea580c
    doc.rect(0, 0, 12, 297, 'F');
    doc.setFillColor(15, 23, 42); // Navy
    doc.rect(12, 0, 4, 297, 'F');

    // EST Badge top right
    doc.setFillColor(234, 88, 12);
    doc.roundedRect(25, 40, 15, 7, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("EST", 29, 45);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Gray-Slate
    doc.text("COST INTELLIGENCE DIVISION", 45, 45);

    // Big titles
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(34);
    doc.setTextColor(15, 23, 42);
    doc.text("COST ENGINE v2.8", 25, 68);

    doc.setFontSize(28);
    doc.setTextColor(234, 88, 12);
    doc.text("ENGINEERING HANDBOOK", 25, 80);

    // High level handbook pitch description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105);
    const subtitleText = "A Mathematical Guide to Construction Cost Estimating, Bill of Quantities (BOQ) Formulation, and Interactive Parameter Calculations.";
    drawWrappedText(doc, subtitleText, 25, 92, 160, 6);

    // Bounding container box: Core Scope Specifications
    const containerY = 118;
    doc.setFillColor(248, 250, 252); // soft #f8fafc
    doc.setDrawColor(226, 232, 240); // divider line
    doc.roundedRect(25, containerY, 158, 102, 5, 5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("CORE TECHNICAL WORKBOOK SCOPE", 32, containerY + 10);

    // Bullet points with coordinates inside the container
    const coverBullets = [
      { text: "Resource Metrics Math: Waste factoring, reusable scaffolding cycles, and measurement conversions for physical materials.", topic: "A. Formulas" },
      { text: "Productivity Dynamics: Crew-hour models, machine duty limits, and dynamic duration estimations for active work blocks.", topic: "B. Operations" },
      { text: "Multi-Parameter Linking: Global variables (working hours, working days per week) propagating across calculating graphs reactive to updates.", topic: "C. Parameters" },
      { text: "Double-Track Workstations: Transitioning seamlessly between high-level expressive budget studies and granular final BOQ rate estimations.", topic: "D. Navigation" }
    ];

    let currentBulletY = containerY + 22;
    coverBullets.forEach((bullet) => {
      doc.setFillColor(234, 88, 12);
      doc.circle(34, currentBulletY - 1, 1.2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(234, 88, 12);
      doc.text(bullet.topic, 38, currentBulletY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      currentBulletY = drawWrappedText(doc, bullet.text, 62, currentBulletY, 112, 4.4) + 4;
    });

    // Metadata cover borders
    doc.setDrawColor(226, 232, 240);
    doc.line(25, 256, 183, 256);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // light slate
    doc.text("DOCUMENT STATUS", 25, 263);
    doc.text("COMPILATION DATE", 135, 263);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // deep navy
    doc.text("RELEASED - VERIFIED (v2.8.4)", 25, 270);
    doc.text(today, 135, 270);


    // ================= PAGE 2: USER GUIDE & ARCHITECTURE =================
    doc.addPage();
    drawPageHeader(doc, "Chapter 1: Workspaces & Systems", "PAGE 2 OF 4");

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("1.1 Double-Track Estimating Framework", 20, 27);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const trackingPitch = "The Cost Engine operates on a Double-Track Workstation Methodology designed to cover both rapid tentative bidding milestones and final detailed engineering takeoffs. These tracks share a common pricing database, ensuring unified direct unit rates.";
    let page2Y = drawWrappedText(doc, trackingPitch, 20, 33, 170, 5) + 6;

    // Track A Styled Card
    doc.setFillColor(253, 250, 247); // soft warm orange gradient replacement
    doc.setDrawColor(254, 215, 170); // soft border
    doc.roundedRect(20, page2Y, 170, 38, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(234, 88, 12); // Orange header
    doc.text("TRACK A: EXPRESS BUDGET WORKSPACE", 25, page2Y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    const trackAPitch = "Optimized for raw quick-bids, conceptual briefs, and preliminary developer feasibility margins. Users list lines dynamically, assigning rough global unit sums and tapping instant AI modeling to yield cost scopes without building heavy active resource recipes.";
    drawWrappedText(doc, trackAPitch, 25, page2Y + 15, 160, 4.6);

    page2Y += 44;

    // Track B Styled Card
    doc.setFillColor(247, 249, 253); // Blue tint
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(20, page2Y, 170, 38, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(37, 99, 235); // Blue header
    doc.text("TRACK B: DETAILED BILL OF QUANTITIES (BOQ) CATALOG", 25, page2Y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    const trackBPitch = "The engineering backbone of the application. Concrete physical line assets are defined alongside a full Rate Analysis Scheme. Every line is broken down into constituent activities drawing real rates (Labor wages, Equipment cost, Materials, Subcontractor offers), building a transparent mathematical cost build-up.";
    drawWrappedText(doc, trackBPitch, 25, page2Y + 15, 160, 4.6);

    page2Y += 48;

    // Section 1.2
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("1.2 Master Central Library Synchronization", 20, page2Y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const syncPitch = "A key advantage of this system is its fully reactive database architecture. Rather than hardcoding localized unit costs inside isolated item lines, the workbook dynamically connects directly to the Central Master Library.";
    page2Y = drawWrappedText(doc, syncPitch, 20, page2Y + 6, 170, 5) + 6;

    // Highlights notice block
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(20, page2Y, 170, 38, 3, 3, 'FD');

    // Accent warning block
    doc.setFillColor(234, 88, 12);
    doc.roundedRect(20, page2Y, 2, 38, 0.5, 0.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("REACTIVE ARCHITECTURE ADVANTAGES:", 26, page2Y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    const advText = "Editing a materials pricing tier, adjustment wastage coefficient, or currency multiplier in the Library automatically fires the core evaluation engine. It traverses all associated active sub-activity costs, updates BOQ item balances, and recalculates final project estimates instantly. This eradicates rounded residual drift.";
    drawWrappedText(doc, advText, 26, page2Y + 14, 158, 4.6);

    drawPageFooter(doc, 2);


    // ================= PAGE 3: MATHEMATICAL FOUNDATIONS =================
    doc.addPage();
    drawPageHeader(doc, "Chapter 2: Calculation Foundations", "PAGE 3 OF 4");

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("2.1 Material Cost Apportionment", 20, 27);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const mathIntro = "Material resource metrics calculate raw dry material substance usage multiplied by wastage parameters, then amortized using custom wear-cycle reuse indexes.";
    let page3Y = drawWrappedText(doc, mathIntro, 20, 33, 170, 5) + 5;

    // Formulas
    const materialFormulas = [
      { label: "[M.01] Unit Cost Contribution (Component Weight):", formula: "unitCost = (consumption * (1 + waste% / 100) / usages) * (libraryRate / conversionFactor) * activityConversionRate" },
      { label: "[M.02] Total Material Quantity Required per Line:", formula: "totalQuantity = boqQty * activityConversionRate * (consumption * (1 + waste% / 100) / usages)" }
    ];
    page3Y = drawFormulaBox(doc, page3Y, materialFormulas) + 2;

    // Title for standard glossary table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("CORE FORMULA VARIABLE GLOSSARY:", 20, page3Y + 3);
    page3Y += 6;

    // Draw Custom Variable Glossary Table Natively (reliable and pixel-perfect!)
    const headers = ["VARIABLE NAME", "ENGINE TYPE", "CALCULATION APORTIONMENT EFFECT"];
    const rows = [
      ["consumption", "Direct Multiplier", "Linear volume unit demand scaled to physical craft output."],
      ["waste%", "Adjustive Cushion", "Factors in breakage, spills, or off-cuts during operation."],
      ["usages", "Amortization Ratio", "Cycles reuse (e.g., scaffolding/shutter panels) over projects."],
      ["activityConv", "Dimensional Scale", "Aligns disparate metrics (e.g. brick counts per square yard)."]
    ];

    // Table Header
    doc.setFillColor(241, 245, 249); // #f1f5f9 background
    doc.rect(20, page3Y, 170, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(headers[0], 23, page3Y + 5);
    doc.text(headers[1], 55, page3Y + 5);
    doc.text(headers[2], 92, page3Y + 5);
    
    doc.setDrawColor(203, 213, 225);
    doc.line(20, page3Y + 7, 190, page3Y + 7);
    page3Y += 7;

    // Table Body
    rows.forEach((row) => {
      doc.setFont('courier', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(234, 88, 12);
      doc.text(row[0], 23, page3Y + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(row[1], 55, page3Y + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(row[2], 92, page3Y + 5.5);

      doc.line(20, page3Y + 8, 190, page3Y + 8);
      page3Y += 8;
    });

    page3Y += 6;

    // Section 2.2
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("2.2 Labor & Equipment Dynamic Time Apportionment", 20, page3Y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const laborIntro = "Unlike materials, crew operations and rental machinery rates are built on active productivity shifts (e.g. cubic meters per shift) mapped against time schedules.";
    page3Y = drawWrappedText(doc, laborIntro, 20, page3Y + 6, 170, 5) + 5;

    const laborFormulas = [
      { label: "[L.01] Duration Modeling (Days Needed to Compile):", formula: "daysRequired = (boqQty * activityConversionRate) / productivity" },
      { label: "[L.02] Direct Cost Contribution per Unit Measure:", formula: "unitCost = (totalQuantity * (libraryRate / conversionFactor)) / boqQty" }
    ];
    drawFormulaBox(doc, page3Y, laborFormulas);

    drawPageFooter(doc, 3);


    // ================= PAGE 4: OPERATIONAL PRODUCTIVITY & DYNAMIC QUANTITIES =================
    doc.addPage();
    drawPageHeader(doc, "Chapter 3: Productivity Dynamics", "PAGE 4 OF 4");

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("3.1 Dynamic Time-Span Resource Scaling", 20, 27);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const schedulingIntro = "To accommodate varying payroll structures (daily wages, weekly shift rates, or monthly corporate salaries), labor and equipment quantity models adapt automatically depending on the resource payment unit selected in the Master database:";
    let page4Y = drawWrappedText(doc, schedulingIntro, 20, 33, 170, 4.8) + 5;

    // Sub-Criteria Containers
    const criteria = [
      { label: "Unit \"day\" (Standard Daily Shift Rate)", formula: "totalQuantity = daysRequired * resourceCount" },
      { label: "Unit \"wk\" (Weekly Wage Basis)", formula: "totalQuantity = (daysRequired / workingDaysPerWeek) * resourceCount" },
      { label: "Unit \"mo\" (Monthly Salary Basis)", formula: "totalQuantity = (daysRequired / (workingDaysPerWeek * 4.33)) * resourceCount" },
      { label: "Unit \"hr\" (Hourly Wages - Standard Default)", formula: "totalQuantity = daysRequired * workingHoursPerDay * resourceCount" }
    ];

    criteria.forEach((item) => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(20, page4Y, 170, 15, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(item.label, 24, page4Y + 5.5);

      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(234, 88, 12);
      doc.text(item.formula, 24, page4Y + 11);

      page4Y += 17;
    });

    page4Y += 4;

    // Section 3.2: Dynamic Parameter Linking Graph
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("3.2 Interactive Parameter Linking Flow", 20, page4Y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const graphIntro = "Primary parameters propagate changes in a unidirectional calculation graph. This dynamic linking maintains complete cost alignment across the entire structural project tree:";
    page4Y = drawWrappedText(doc, graphIntro, 20, page4Y + 6, 170, 4.8) + 8;

    // Drawing the schematic Node block diagram!
    const nodes = [
      { num: "1", title: "GLOBAL CONTRACT VALUES", subtitle: "workingHours, workingDays" },
      { num: "2", title: "ACTIVITY PRODUCTIVITY MODEL", subtitle: "outputRate, conversionScale" },
      { num: "3", title: "RESOURCE METRICS ALLOCATION", subtitle: "wastage allowances, duration scales" },
      { num: "4", title: "FINAL BOQ QUANTITY AND UNIT RATE", subtitle: "Total valuation summary balance" }
    ];

    nodes.forEach((node, i) => {
      // Draw Connector Arrow Down
      if (i > 0) {
        doc.setDrawColor(234, 88, 12);
        doc.setLineWidth(0.6);
        doc.line(105, page4Y - 8, 105, page4Y - 2);
        
        // draw tiny triangle arrow head
        doc.setFillColor(234, 88, 12);
        doc.triangle(103.5, page4Y - 4, 106.5, page4Y - 4, 105, page4Y - 1.5, 'FD');
      }

      // Draw Node Box
      doc.setFillColor(239, 246, 255); // soft light blue node base
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(35, page4Y, 140, 12, 1.5, 1.5, 'FD');

      // Index Badge
      doc.setFillColor(37, 99, 235); // Blue
      doc.circle(41, page4Y + 6, 3, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(node.num, 40, page4Y + 8.8);

      // Node text details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(node.title, 48, page4Y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(node.subtitle, 48, page4Y + 9.5);

      page4Y += 20;
    });

    drawPageFooter(doc, 4);

    // Save PDF
    const fileName = `Cost_Engine_Engineering_Handbook_v2.8.pdf`;
    doc.save(fileName);

    if (setNotification) {
      setNotification({ message: 'Engineering Handbook PDF Downloaded successfully!', type: 'success' });
    }

  } catch (error) {
    console.error('Core Handbook PDF Generation Failed:', error);
    if (setNotification) {
      setNotification({ message: 'Engineering Handbook compilation failed.', type: 'error' });
    }
  }
};
