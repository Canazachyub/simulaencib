import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExamResult } from '../types';
import { PERFORMANCE_MESSAGES, ALL_UNIVERSITIES, SITE_NAME } from '../types';
import { formatDate, formatTimeReadable, formatVigesimalScore, formatPoints } from '../utils/calculations';

// jsPDF (fuentes estándar) no maneja bien algunos caracteres tipográficos
function pdfText(text: string): string {
  return text
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...');
}

// Subtítulo del PDF por examen (sin tildes por compatibilidad con jsPDF)
const PDF_DESCRIPTIONS: Record<string, string> = {
  encib: 'Examen Nacional de Ciencias Basicas - ASPEFAM',
  enam: 'Examen Nacional de Medicina - ASPEFAM',
  rm: 'Examen de admision al Residentado Medico - CONAREME',
  serums: 'Evaluacion para el SERUMS - MINSA',
  essalud: 'Examen de ingreso al Internado Medico EsSalud'
};

interface PDFGeneratorProps {
  result: ExamResult;
}

export function PDFGenerator({ result }: PDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = 20;

      // Obtener nombre de la universidad
      const universityInfo = ALL_UNIVERSITIES.find(u => u.code === result.student.university);
      const universityName = universityInfo ? universityInfo.name : result.student.university;
      const examName = result.examName ?? 'ENCIB';
      const scaleMax = result.scaleMax ?? 20;
      const passing = result.passing ?? null;
      const hasWeightedPoints = Math.abs((result.maxPoints ?? result.totalQuestions) - result.totalQuestions) > 0.001;

      // Header
      doc.setFillColor(8, 145, 178); // cyan-600
      doc.rect(0, 0, pageWidth, 45, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(SITE_NAME, pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(pdfText(`Resultados del Simulacro ${examName}`), pageWidth / 2, 30, { align: 'center' });
      if (result.examId) {
        doc.setFontSize(9);
        const examDesc = pdfText(doc.splitTextToSize(PDF_DESCRIPTIONS[result.examId] ?? '', pageWidth - 40)[0] ?? '');
        if (examDesc) doc.text(examDesc, pageWidth / 2, 38, { align: 'center' });
      }

      yPos = 55;

      // Student info box
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 45, 3, 3, 'F');

      doc.setTextColor(71, 85, 105); // slate-600
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('DATOS DEL ESTUDIANTE', margin + 5, yPos + 10);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(`DNI: ${result.student.dni}`, margin + 5, yPos + 22);
      doc.text(`Nombre: ${result.student.fullName}`, margin + 5, yPos + 32);
      doc.text(pdfText(`Universidad: ${doc.splitTextToSize(universityName || '', pageWidth / 2 - margin - 5)[0] ?? ''}`), pageWidth / 2, yPos + 22);
      doc.text(`Fecha: ${formatDate(result.date)}`, pageWidth / 2, yPos + 32);

      yPos += 55;

      // Score box - Nota en la escala del examen
      const performanceInfo = PERFORMANCE_MESSAGES[result.performanceLevel];
      doc.setFillColor(236, 254, 255); // cyan-50
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 45, 3, 3, 'F');

      // Nota grande
      doc.setTextColor(8, 145, 178); // cyan-600
      doc.setFontSize(32);
      doc.setFont('helvetica', 'bold');
      doc.text(formatVigesimalScore(result.vigesimalScore), pageWidth / 2, yPos + 20, { align: 'center' });

      doc.setFontSize(14);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont('helvetica', 'normal');
      doc.text(`/ ${scaleMax}  (Nota)`, pageWidth / 2 + 20, yPos + 20, { align: 'left' });

      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(
        pdfText(
          `${result.correctAnswers} de ${result.totalQuestions} correctas  |  ${result.percentage.toFixed(1)}%  |  ` +
          (passing !== null
            ? `${result.passed ? 'APROBADO' : 'DESAPROBADO'} (minima ${passing})`
            : performanceInfo.title)
        ),
        pageWidth / 2,
        yPos + 35,
        { align: 'center' }
      );

      yPos += 55;

      // Quick stats
      const totalCorrect = result.correctAnswers;
      const totalIncorrect = result.totalQuestions - totalCorrect;

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);

      const statsY = yPos;
      const statsWidth = (pageWidth - margin * 2) / 4;

      // Correctas
      doc.setFillColor(236, 253, 245); // emerald-50
      doc.roundedRect(margin, statsY, statsWidth - 5, 25, 2, 2, 'F');
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.setFont('helvetica', 'bold');
      doc.text(String(totalCorrect), margin + statsWidth / 2 - 2.5, statsY + 12, { align: 'center' });
      doc.setFontSize(8);
      doc.text('Correctas', margin + statsWidth / 2 - 2.5, statsY + 20, { align: 'center' });

      // Incorrectas
      doc.setFillColor(254, 242, 242); // red-50
      doc.roundedRect(margin + statsWidth, statsY, statsWidth - 5, 25, 2, 2, 'F');
      doc.setTextColor(220, 38, 38); // red-600
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(String(totalIncorrect), margin + statsWidth * 1.5 - 2.5, statsY + 12, { align: 'center' });
      doc.setFontSize(8);
      doc.text('Incorrectas', margin + statsWidth * 1.5 - 2.5, statsY + 20, { align: 'center' });

      // Tiempo total
      doc.setFillColor(236, 254, 255); // cyan-50
      doc.roundedRect(margin + statsWidth * 2, statsY, statsWidth - 5, 25, 2, 2, 'F');
      doc.setTextColor(8, 145, 178); // cyan-600
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(formatTimeReadable(result.totalTime), margin + statsWidth * 2.5 - 2.5, statsY + 12, { align: 'center' });
      doc.setFontSize(8);
      doc.text('Tiempo total', margin + statsWidth * 2.5 - 2.5, statsY + 20, { align: 'center' });

      // Total preguntas
      doc.setFillColor(240, 249, 255); // sky-50
      doc.roundedRect(margin + statsWidth * 3, statsY, statsWidth - 5, 25, 2, 2, 'F');
      doc.setTextColor(14, 116, 144); // cyan-700
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(String(result.totalQuestions), margin + statsWidth * 3.5 - 2.5, statsY + 12, { align: 'center' });
      doc.setFontSize(8);
      doc.text('Preguntas', margin + statsWidth * 3.5 - 2.5, statsY + 20, { align: 'center' });

      yPos += 35;

      // Table title
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text('RESULTADOS POR CURSO', margin, yPos);

      yPos += 5;

      // Tabla de resultados por curso (con columna de puntos si el examen pondera)
      const tableData = result.courseResults.map((course) => {
        const row = [
          pdfText(course.name),
          `${course.correctAnswers} / ${course.totalQuestions}`,
          `${course.percentage.toFixed(1)}%`
        ];
        if (hasWeightedPoints) row.push(`${formatPoints(course.pointsEarned ?? 0)} / ${formatPoints(course.pointsTotal ?? 0)}`);
        return row;
      });

      // Fila de totales
      const totalRow = [
        'TOTAL',
        `${totalCorrect} / ${result.totalQuestions}`,
        `${result.percentage.toFixed(1)}%`
      ];
      if (hasWeightedPoints) totalRow.push(`${formatPoints(result.rawScore)} / ${formatPoints(result.maxPoints)}`);
      tableData.push(totalRow);

      // Fila de nota
      const noteRow = [
        `NOTA (0-${scaleMax})` + (passing !== null ? (result.passed ? ' - APROBADO' : ' - DESAPROBADO') : ''),
        '',
        formatVigesimalScore(result.vigesimalScore) + ` / ${scaleMax}`
      ];
      if (hasWeightedPoints) noteRow.push('');
      tableData.push(noteRow);

      const head = hasWeightedPoints
        ? [['Curso / área', 'Correctas', 'Porcentaje', 'Puntos']]
        : [['Curso / área', 'Correctas', 'Porcentaje']];

      autoTable(doc, {
        startY: yPos,
        head,
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [8, 145, 178], // cyan-600
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          textColor: [30, 41, 59],
          fontSize: 9
        },
        columnStyles: {
          0: { halign: 'left' },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        didParseCell: function(data) {
          // Style the TOTAL row
          if (data.row.index === tableData.length - 2) {
            data.cell.styles.fillColor = [236, 254, 255]; // cyan-50
            data.cell.styles.textColor = [8, 145, 178]; // cyan-600
            data.cell.styles.fontStyle = 'bold';
          }
          // Style the NOTA row
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [8, 145, 178]; // cyan-600
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        margin: { left: margin, right: margin }
      });

      // Footer
      let finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
      if (finalY > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        finalY = 20;
      }
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(
        pdfText(`Este documento fue generado automaticamente por ${SITE_NAME}.`),
        pageWidth / 2,
        finalY,
        { align: 'center' }
      );
      doc.text(
        pdfText(`Simulacro ${examName} - formato basado en el examen oficial`),
        pageWidth / 2,
        finalY + 6,
        { align: 'center' }
      );

      // Save PDF
      const fileName = `Simulacro_${(result.examId || 'encib').toUpperCase()}_${result.student.dni}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF. Por favor, intenta de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={generatePDF}
      disabled={isGenerating}
      className="btn-primary"
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Generando...
        </>
      ) : (
        <>
          <Download className="w-5 h-5" />
          Descargar PDF
        </>
      )}
    </button>
  );
}
