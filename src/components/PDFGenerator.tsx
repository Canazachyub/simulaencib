import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExamResult } from '../types';
import { PERFORMANCE_MESSAGES, ALL_UNIVERSITIES } from '../types';
import { formatNumber, formatDate, formatTimeReadable, formatVigesimalScore } from '../utils/calculations';

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

      // Header - Cyan color for ENCIB
      doc.setFillColor(8, 145, 178); // cyan-600
      doc.rect(0, 0, pageWidth, 45, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('SimulaENCIB', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Resultados del Simulacro ENCIB', pageWidth / 2, 30, { align: 'center' });
      doc.text('Examen Nacional de Ciencias Basicas', pageWidth / 2, 38, { align: 'center' });

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
      doc.text(`Universidad: ${universityName}`, pageWidth / 2, yPos + 22);
      doc.text(`Fecha: ${formatDate(result.date)}`, pageWidth / 2, yPos + 32);

      yPos += 55;

      // Score box - Vigesimal prominente
      const performanceInfo = PERFORMANCE_MESSAGES[result.performanceLevel];
      doc.setFillColor(236, 254, 255); // cyan-50
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 45, 3, 3, 'F');

      // Nota Vigesimal grande
      doc.setTextColor(8, 145, 178); // cyan-600
      doc.setFontSize(32);
      doc.setFont('helvetica', 'bold');
      doc.text(formatVigesimalScore(result.vigesimalScore), pageWidth / 2, yPos + 20, { align: 'center' });

      doc.setFontSize(14);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont('helvetica', 'normal');
      doc.text('/ 20  (Nota Vigesimal)', pageWidth / 2 + 20, yPos + 20, { align: 'left' });

      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `${result.correctAnswers} de ${result.totalQuestions} correctas  |  ${result.percentage.toFixed(1)}%  |  ${performanceInfo.title}`,
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

      // Results table - ENCIB format (sin columna de puntos)
      const tableData = result.courseResults.map((course) => [
        course.name,
        `${course.correctAnswers} / ${course.totalQuestions}`,
        `${course.percentage.toFixed(1)}%`
      ]);

      // Add totals row
      tableData.push([
        'TOTAL',
        `${totalCorrect} / ${result.totalQuestions}`,
        `${result.percentage.toFixed(1)}%`
      ]);

      // Add vigesimal row
      tableData.push([
        'NOTA VIGESIMAL',
        '',
        formatVigesimalScore(result.vigesimalScore) + ' / 20'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Curso', 'Correctas', 'Porcentaje']],
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
          2: { halign: 'center' }
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
          // Style the NOTA VIGESIMAL row
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [8, 145, 178]; // cyan-600
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        margin: { left: margin, right: margin }
      });

      // Footer
      const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'Este documento fue generado automaticamente por SimulaENCIB.',
        pageWidth / 2,
        finalY,
        { align: 'center' }
      );
      doc.text(
        'Examen Nacional de Ciencias Basicas - ASPEFAM',
        pageWidth / 2,
        finalY + 6,
        { align: 'center' }
      );

      // Save PDF
      const fileName = `SimulaENCIB_${result.student.dni}_${new Date().toISOString().split('T')[0]}.pdf`;
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
      className="btn-primary bg-cyan-600 hover:bg-cyan-700"
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
