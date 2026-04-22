import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/models/inspection_model.dart';

class ActaInspeccionPage extends StatelessWidget {
  final InspectionModel inspection;
  const ActaInspeccionPage({super.key, required this.inspection});

  @override
  Widget build(BuildContext context) {
    final idSuffix = inspection.id.length > 8
        ? inspection.id.substring(inspection.id.length - 8).toUpperCase()
        : inspection.id.toUpperCase();

    final (color, bg, border) = _resultColors(inspection.result);
    final resultLabel = _resultLabel(inspection.result);
    final vehicleLabel = _vehicleTypeLabel(
      inspection.vehicle?.vehicleTypeKey ?? inspection.vehicleTypeKey,
    );

    final brandModel = '${inspection.vehicle?.brand ?? ''} ${inspection.vehicle?.model ?? ''}'.trim();

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: Text(
          'Acta de inspección',
          style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700),
        ),
        backgroundColor: AppColors.panel,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: AppColors.ink2),
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Text(
                    'SISTEMA DE FISCALIZACIÓN INTELIGENTE DE TRANSPORTE',
                    textAlign: TextAlign.center,
                    style: AppTheme.inter(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink5,
                      letterSpacing: 1.8,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'ACTA DE INSPECCIÓN VEHICULAR',
                    textAlign: TextAlign.center,
                    style: AppTheme.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: AppColors.panel,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'N° $idSuffix',
                    textAlign: TextAlign.center,
                    style: AppTheme.inter(
                      fontSize: 12,
                      color: AppColors.ink5,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: bg,
                border: Border.all(color: border),
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'RESULTADO',
                          style: AppTheme.inter(
                            fontSize: 11,
                            color: AppColors.ink5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          resultLabel,
                          style: AppTheme.inter(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: color,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${inspection.score}/100',
                        style: AppTheme.inter(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: color,
                          tabular: true,
                        ),
                      ),
                      Text(
                        'PUNTAJE',
                        style: AppTheme.inter(
                          fontSize: 11,
                          color: AppColors.ink5,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _ActaSection(
              title: 'DATOS DEL VEHÍCULO',
              rows: [
                ('Placa', inspection.vehicle?.plate ?? '—'),
                (
                  'Marca / Modelo',
                  brandModel.isEmpty ? '—' : brandModel,
                ),
                ('Tipo', vehicleLabel),
              ],
            ),
            const SizedBox(height: 12),
            _ActaSection(
              title: 'DATOS DE LA INSPECCIÓN',
              rows: [
                (
                  'Fecha',
                  DateFormat('dd/MM/yyyy HH:mm').format(inspection.date),
                ),
                (
                  'Inspector',
                  inspection.fiscal?['name'] as String? ?? '—',
                ),
              ],
            ),
            if (inspection.observations != null &&
                inspection.observations!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: AppColors.ink2),
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'OBSERVACIONES',
                      style: AppTheme.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink5,
                        letterSpacing: 1.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      inspection.observations!,
                      style: AppTheme.inter(
                        fontSize: 13.5,
                        color: AppColors.ink8,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 24),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: AppColors.ink2),
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        Container(
                          width: 120,
                          height: 1,
                          color: AppColors.ink2,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Firma del Inspector',
                          textAlign: TextAlign.center,
                          style: AppTheme.inter(
                            fontSize: 11,
                            color: AppColors.ink5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      children: [
                        Container(
                          width: 120,
                          height: 1,
                          color: AppColors.ink2,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Sello Municipal',
                          textAlign: TextAlign.center,
                          style: AppTheme.inter(
                            fontSize: 11,
                            color: AppColors.ink5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Este documento es generado automáticamente por el Sistema SFIT y tiene validez oficial. Fecha de emisión: ${DateFormat('dd/MM/yyyy').format(DateTime.now())}',
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 10,
                color: AppColors.ink4,
              ),
            ),
          ],
        ),
      ),
    );
  }

  (Color, Color, Color) _resultColors(String result) => switch (result) {
        'aprobada' => (AppColors.apto, AppColors.aptoBg, AppColors.aptoBorder),
        'observada' => (
          AppColors.riesgo,
          AppColors.riesgoBg,
          AppColors.riesgoBorder,
        ),
        _ => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder),
      };

  String _resultLabel(String r) => switch (r) {
        'aprobada' => 'APROBADA',
        'observada' => 'OBSERVADA',
        _ => 'RECHAZADA',
      };
}

String _vehicleTypeLabel(String k) => switch (k) {
      'transporte_publico' => 'Transporte público',
      'limpieza_residuos' => 'Limpieza / Residuos',
      'emergencia' => 'Emergencia',
      'maquinaria' => 'Maquinaria',
      _ => 'Municipal',
    };

class _ActaSection extends StatelessWidget {
  final String title;
  final List<(String, String)> rows;
  const _ActaSection({required this.title, required this.rows});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Text(
              title,
              style: AppTheme.inter(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.ink5,
                letterSpacing: 1.5,
              ),
            ),
          ),
          for (final row in rows) ...[
            const Divider(
              height: 1,
              color: AppColors.ink1,
              indent: 16,
              endIndent: 16,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: Row(
                children: [
                  Text(
                    row.$1,
                    style: AppTheme.inter(
                      fontSize: 13,
                      color: AppColors.ink5,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    row.$2,
                    style: AppTheme.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink8,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
