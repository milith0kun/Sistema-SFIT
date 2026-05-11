import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';

/// Cambio de estado de fatiga del conductor (apto / riesgo / no_apto).
///
/// Rol fiscal. Backend valida con `FATIGUE_ROLES` en
/// `sfit-web/src/app/api/conductores/[id]/route.ts` (PATCH).
class FatigaConductorPage extends ConsumerStatefulWidget {
  const FatigaConductorPage({super.key});

  @override
  ConsumerState<FatigaConductorPage> createState() =>
      _FatigaConductorPageState();
}

class _FatigaConductorPageState extends ConsumerState<FatigaConductorPage> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  List<Map<String, dynamic>> _results = [];
  bool _searching = false;
  Map<String, dynamic>? _selected;
  String? _newStatus;
  bool _submitting = false;

  static const _statuses = <({String value, String label, Color color})>[
    (value: 'apto', label: 'Apto', color: AppColors.apto),
    (value: 'riesgo', label: 'Riesgo', color: AppColors.riesgo),
    (value: 'no_apto', label: 'No apto', color: AppColors.noApto),
  ];

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    final term = value.trim();
    if (term.length < 2) {
      setState(() {
        _results = [];
        _searching = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () => _doSearch(term));
  }

  Future<void> _doSearch(String term) async {
    setState(() => _searching = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/conductores', queryParameters: {
        'q': term,
        'limit': 10,
      });
      final body = resp.data as Map?;
      final data = body?['data'] as Map?;
      final items = (data?['items'] as List?) ?? const [];
      if (!mounted) return;
      setState(() {
        _results = items.cast<Map<String, dynamic>>();
        _searching = false;
      });
    } on DioException {
      if (!mounted) return;
      setState(() {
        _results = [];
        _searching = false;
      });
    }
  }

  Future<void> _submit() async {
    final driver = _selected;
    final status = _newStatus;
    if (driver == null || status == null) return;
    if (status == driver['status']) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('El estado seleccionado es el actual.')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.patch(
        '/conductores/${driver['id']}',
        data: {'status': status},
      );
      final ok = (resp.data as Map?)?['success'] == true;
      if (!mounted) return;
      if (ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Estado de ${driver['name']} actualizado a "$status".',
            ),
          ),
        );
        if (mounted) context.pop();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo actualizar el estado.')),
        );
      }
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = (e.response?.data as Map?)?['error']?.toString() ??
          'Error de red';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg)),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Color _statusColor(String? s) {
    return switch (s) {
      'apto' => AppColors.apto,
      'riesgo' => AppColors.riesgo,
      'no_apto' => AppColors.noApto,
      _ => Colors.grey,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Fatiga del conductor')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _searchCtrl,
                onChanged: _onSearchChanged,
                decoration: InputDecoration(
                  labelText: 'Buscar por DNI, nombre o licencia',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _searching
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : null,
                  border: const OutlineInputBorder(),
                ),
                inputFormatters: [LengthLimitingTextInputFormatter(60)],
              ),
              const SizedBox(height: 12),
              if (_selected == null) ...[
                Expanded(
                  child: _results.isEmpty
                      ? const Center(
                          child: Text(
                            'Escribe al menos 2 caracteres para buscar.',
                            style: TextStyle(color: Colors.grey),
                          ),
                        )
                      : ListView.separated(
                          itemCount: _results.length,
                          separatorBuilder: (_, __) =>
                              const Divider(height: 1),
                          itemBuilder: (_, i) {
                            final d = _results[i];
                            final status = d['status'] as String?;
                            return ListTile(
                              leading: CircleAvatar(
                                backgroundColor:
                                    _statusColor(status).withValues(alpha: 0.15),
                                child: Icon(
                                  Icons.person,
                                  color: _statusColor(status),
                                ),
                              ),
                              title: Text(d['name']?.toString() ?? '—'),
                              subtitle: Text(
                                'DNI ${d['dni'] ?? '—'} · Lic ${d['licenseNumber'] ?? '—'}',
                              ),
                              trailing: Chip(
                                label: Text(status ?? '—'),
                                backgroundColor:
                                    _statusColor(status).withValues(alpha: 0.15),
                              ),
                              onTap: () => setState(() {
                                _selected = d;
                                _newStatus = status;
                              }),
                            );
                          },
                        ),
                ),
              ] else ...[
                Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor:
                          _statusColor(_selected!['status'] as String?)
                              .withValues(alpha: 0.15),
                      child: Icon(
                        Icons.person,
                        color: _statusColor(_selected!['status'] as String?),
                      ),
                    ),
                    title: Text(_selected!['name']?.toString() ?? '—'),
                    subtitle: Text(
                      'DNI ${_selected!['dni'] ?? '—'} · ${_selected!['companyName'] ?? 'sin empresa'}',
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.close),
                      tooltip: 'Cambiar conductor',
                      onPressed: () => setState(() {
                        _selected = null;
                        _newStatus = null;
                      }),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Nuevo estado',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: _statuses.map((s) {
                    final selected = _newStatus == s.value;
                    return ChoiceChip(
                      label: Text(s.label),
                      selected: selected,
                      onSelected: (_) => setState(() => _newStatus = s.value),
                      selectedColor: s.color.withValues(alpha: 0.25),
                      labelStyle: TextStyle(
                        color: selected ? s.color : null,
                        fontWeight: selected ? FontWeight.w600 : null,
                      ),
                    );
                  }).toList(),
                ),
                const Spacer(),
                FilledButton.icon(
                  onPressed: _submitting || _newStatus == null ? null : _submit,
                  icon: _submitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.check),
                  label: const Text('Confirmar cambio'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
