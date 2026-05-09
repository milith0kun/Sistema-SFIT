import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/models/route_candidate_model.dart';

/// Comparativa side-by-side de 2-3 capturas GPS candidatas.
///
/// El operador llega a esta pantalla seleccionando varias capturas en el tab
/// "Candidatas" y tocando "Comparar". Aquí ve mini-mapas con bounding box
/// compartido + tabla de métricas para decidir cuál validar como ruta.
///
/// La página NO escribe en BD: cada captura se valida con su flujo existente
/// (`operator_candidate_detail_page`). Esta vista solo facilita la decisión.
class OperatorCandidatesComparePage extends ConsumerWidget {
  final List<RouteCandidateModel> candidates;

  const OperatorCandidatesComparePage({super.key, required this.candidates});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (candidates.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Comparar capturas')),
        body: const Center(child: Text('Sin capturas para comparar')),
      );
    }

    // Bounding box compartido — todos los mini-mapas usan los mismos límites
    // para que las distancias sean visualmente comparables.
    final allPoints = <LatLng>[];
    for (final c in candidates) {
      allPoints.addAll(_pointsToLatLng(c.points));
    }
    final sharedBounds = allPoints.length >= 2
        ? LatLngBounds.fromPoints(allPoints)
        : null;

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          onPressed: () => context.pop(),
          icon: const Icon(Icons.close, color: AppColors.ink9),
        ),
        title: Text(
          'Comparar ${candidates.length} capturas',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _Legend(),
            const SizedBox(height: 14),
            // Grid de mini-mapas
            LayoutBuilder(
              builder: (context, constraints) {
                final cols = candidates.length == 3 ? 3 : 2;
                final w = (constraints.maxWidth - (cols - 1) * 10) / cols;
                return Wrap(
                  spacing: 10,
                  runSpacing: 14,
                  children: candidates
                      .map(
                        (c) => SizedBox(
                          width: w,
                          child: _CandidateColumn(
                            candidate: c,
                            sharedBounds: sharedBounds,
                          ),
                        ),
                      )
                      .toList(),
                );
              },
            ),
            const SizedBox(height: 18),
            // Tabla comparativa
            _ComparisonTable(candidates: candidates),
            const SizedBox(height: 18),
            Text(
              'Toca una captura para validarla, asignarla o descartarla.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5),
            ),
          ],
        ),
      ),
    );
  }
}

class _CandidateColumn extends StatelessWidget {
  final RouteCandidateModel candidate;
  final LatLngBounds? sharedBounds;

  const _CandidateColumn({required this.candidate, this.sharedBounds});

  @override
  Widget build(BuildContext context) {
    final points = _pointsToLatLng(candidate.points);
    final score = ((candidate.avgConfidence ?? 0) * 100).round();
    final scoreColor = score >= 80
        ? AppColors.apto
        : score >= 60
            ? AppColors.riesgo
            : AppColors.noApto;

    return InkWell(
      onTap: () => context.push('/operador/candidate/${candidate.id}'),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.ink2),
          borderRadius: BorderRadius.circular(12),
          color: Colors.white,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 140,
              child: points.length < 2
                  ? Container(
                      color: AppColors.ink1,
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.map_outlined,
                        color: AppColors.ink4,
                      ),
                    )
                  : AbsorbPointer(
                      child: FlutterMap(
                        options: MapOptions(
                          initialCameraFit: CameraFit.bounds(
                            bounds: sharedBounds ?? LatLngBounds.fromPoints(points),
                            padding: const EdgeInsets.all(10),
                          ),
                          interactionOptions: const InteractionOptions(
                            flags: InteractiveFlag.none,
                          ),
                        ),
                        children: [
                          TileLayer(
                            urlTemplate:
                                'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                            subdomains: const ['a', 'b', 'c', 'd'],
                            userAgentPackageName: 'com.sfit.sfit_app',
                          ),
                          PolylineLayer(polylines: [
                            Polyline(
                              points: points,
                              strokeWidth: 3,
                              color: AppColors.primary,
                            ),
                          ]),
                          MarkerLayer(markers: [
                            Marker(
                              point: points.first,
                              width: 12,
                              height: 12,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: AppColors.apto,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 1.5,
                                  ),
                                ),
                              ),
                            ),
                            Marker(
                              point: points.last,
                              width: 12,
                              height: 12,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: AppColors.noApto,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 1.5,
                                  ),
                                ),
                              ),
                            ),
                          ]),
                        ],
                      ),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    candidate.suggestedName?.trim().isNotEmpty == true
                        ? candidate.suggestedName!
                        : 'Captura GPS',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTheme.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink9,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: scoreColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'Score $score',
                      style: AppTheme.inter(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        color: scoreColor,
                        tabular: true,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ComparisonTable extends StatelessWidget {
  final List<RouteCandidateModel> candidates;

  const _ComparisonTable({required this.candidates});

  @override
  Widget build(BuildContext context) {
    final rows = <_MetricRow>[
      _MetricRow(
        label: 'Distancia (km)',
        values: candidates
            .map((c) => ((c.distanceMeters ?? 0) / 1000).toStringAsFixed(2))
            .toList(),
      ),
      _MetricRow(
        label: 'Puntos GPS',
        values: candidates.map((c) => '${c.sampleCount ?? c.points.length}').toList(),
      ),
      _MetricRow(
        label: 'Score (%)',
        values: candidates
            .map((c) => '${((c.avgConfidence ?? 0) * 100).round()}')
            .toList(),
      ),
      _MetricRow(
        label: 'Paradas detectadas',
        values: candidates.map((c) => '${c.detectedStops.length}').toList(),
      ),
      _MetricRow(
        label: 'Estado',
        values: candidates.map((c) => c.status ?? '—').toList(),
      ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.ink2),
            _MetricRowWidget(row: rows[i], cols: candidates.length),
          ],
        ],
      ),
    );
  }
}

class _MetricRow {
  final String label;
  final List<String> values;
  const _MetricRow({required this.label, required this.values});
}

class _MetricRowWidget extends StatelessWidget {
  final _MetricRow row;
  final int cols;

  const _MetricRowWidget({required this.row, required this.cols});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              row.label,
              style: AppTheme.inter(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.ink5,
              ),
            ),
          ),
          for (var i = 0; i < row.values.length; i++)
            Expanded(
              child: Text(
                row.values[i],
                textAlign: TextAlign.center,
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  tabular: true,
                ),
              ),
            ),
          // Si solo hay 2 columnas en una pantalla pensada para 3, balancear.
          if (row.values.length < cols)
            for (var i = row.values.length; i < cols; i++)
              const Expanded(child: SizedBox()),
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend();
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const _Dot(color: AppColors.apto),
        const SizedBox(width: 4),
        Text(
          'inicio',
          style: AppTheme.inter(fontSize: 11, color: AppColors.ink6),
        ),
        const SizedBox(width: 14),
        const _Dot(color: AppColors.noApto),
        const SizedBox(width: 4),
        Text(
          'fin',
          style: AppTheme.inter(fontSize: 11, color: AppColors.ink6),
        ),
        const SizedBox(width: 14),
        Container(
          width: 14,
          height: 3,
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          'trazado',
          style: AppTheme.inter(fontSize: 11, color: AppColors.ink6),
        ),
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  final Color color;
  const _Dot({required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 1),
      ),
    );
  }
}

/// Convierte el array `points` heterogéneo en `List<LatLng>`. Acepta forma
/// `[{lat, lng}, ...]` o `[{lat, lng, ts}, ...]`.
List<LatLng> _pointsToLatLng(List<Map<String, dynamic>> raw) {
  return raw
      .where((p) => p['lat'] is num && p['lng'] is num)
      .map((p) => LatLng((p['lat'] as num).toDouble(), (p['lng'] as num).toDouble()))
      .toList();
}
