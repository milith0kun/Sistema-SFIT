import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// CRUD de pasajeros del operador (mobile) — RF-09.
class PassengerListPage extends ConsumerStatefulWidget {
  final String tripId;
  const PassengerListPage({super.key, required this.tripId});

  @override
  ConsumerState<PassengerListPage> createState() =>
      _PassengerListPageState();
}

class _PassengerListPageState extends ConsumerState<PassengerListPage> {
  bool _loading = true;
  bool _busy = false;
  List<_Passenger> _items = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
    });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp =
          await dio.get('/viajes/${widget.tripId}/pasajeros');
      final body = resp.data as Map?;
      final data = (body?['data'] as Map?) ?? body ?? const {};
      final list = (data['items'] as List? ?? data['pasajeros'] as List? ?? const [])
          .map((e) => _Passenger.fromJson(e as Map<String, dynamic>))
          .toList();
      if (mounted) {
        setState(() {
          _items = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _items = const [];
          _loading = false;
        });
      }
    }
  }

  Future<void> _delete(_Passenger p) async {
    setState(() => _busy = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      await dio.delete('/viajes/${widget.tripId}/pasajeros/${p.id}');
      _snack('Pasajero eliminado.');
      await _load();
    } catch (_) {
      _snack('No se pudo eliminar.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openForm({_Passenger? edit}) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (_) => _PassengerForm(initial: edit),
    );
    if (result == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      if (edit == null) {
        // POST espera { passengers: [...] } con shape Passenger del backend.
        await dio.post(
          '/viajes/${widget.tripId}/pasajeros',
          data: {
            'passengers': [result],
          },
        );
        _snack('Pasajero agregado.');
      } else {
        // PATCH acepta el partial directo del Passenger.
        await dio.patch(
          '/viajes/${widget.tripId}/pasajeros/${edit.id}',
          data: result,
        );
        _snack('Pasajero actualizado.');
      }
      await _load();
    } catch (e) {
      _snack('Error: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _importExcel() async {
    setState(() => _busy = true);
    try {
      final picked = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['xlsx', 'xls', 'csv'],
        withData: true,
      );
      if (picked == null || picked.files.isEmpty) {
        if (mounted) setState(() => _busy = false);
        return;
      }
      final file = picked.files.single;
      final bytes = file.bytes;
      final path = file.path;

      MultipartFile mp;
      if (bytes != null) {
        mp = MultipartFile.fromBytes(bytes, filename: file.name);
      } else if (path != null) {
        mp = await MultipartFile.fromFile(path, filename: file.name);
      } else {
        _snack('No se pudo leer el archivo.');
        return;
      }

      final form = FormData.fromMap({'file': mp});
      final dio = ref.read(dioClientProvider).dio;
      await dio.post(
        '/viajes/${widget.tripId}/pasajeros/import',
        data: form,
        options: Options(
          headers: {'Content-Type': 'multipart/form-data'},
        ),
      );
      _snack('Importación correcta.');
      await _load();
    } catch (e) {
      _snack('No se pudo importar: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _downloadManifest() async {
    final url = Uri.parse(
      '${ApiConstants.baseUrl}/viajes/${widget.tripId}/manifiesto.xlsx',
    );
    try {
      final ok = await launchUrl(url, mode: LaunchMode.externalApplication);
      if (!ok) _snack('No se pudo abrir el manifiesto.');
    } catch (_) {
      _snack('No se pudo abrir el manifiesto.');
    }
  }

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(m), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text(
          'Pasajeros (${_items.length})',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Importar Excel',
            onPressed: _busy ? null : _importExcel,
            icon: const Icon(
              Icons.upload_file_outlined,
              color: AppColors.ink8,
            ),
          ),
          IconButton(
            tooltip: 'Descargar manifiesto',
            onPressed: _busy ? null : _downloadManifest,
            icon: const Icon(
              Icons.download_outlined,
              color: AppColors.ink8,
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _load,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              )
            : _items.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 80),
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(children: [
                          const Icon(
                            Icons.groups_2_outlined,
                            size: 36,
                            color: AppColors.ink4,
                          ),
                          const SizedBox(height: 10),
                          Text(
                            'Sin pasajeros',
                            style: AppTheme.inter(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink8,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Agrega manualmente o importa desde Excel.',
                            textAlign: TextAlign.center,
                            style: AppTheme.inter(
                              fontSize: 12,
                              color: AppColors.ink5,
                            ),
                          ),
                        ]),
                      ),
                    ),
                  ])
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (_, i) {
                      final p = _items[i];
                      return Dismissible(
                        key: ValueKey('pax_${p.id}'),
                        direction: DismissDirection.endToStart,
                        background: Container(
                          alignment: Alignment.centerRight,
                          padding:
                              const EdgeInsets.symmetric(horizontal: 18),
                          decoration: BoxDecoration(
                            color: AppColors.noAptoBg,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.noAptoBorder),
                          ),
                          child: const Icon(
                            Icons.delete_outline,
                            color: AppColors.noApto,
                          ),
                        ),
                        confirmDismiss: (_) async {
                          return await showDialog<bool>(
                                context: context,
                                builder: (_) => AlertDialog(
                                  title: const Text('Eliminar pasajero'),
                                  content: Text(
                                    '¿Quitar a ${p.name} del viaje?',
                                  ),
                                  actions: [
                                    TextButton(
                                      onPressed: () =>
                                          Navigator.pop(context, false),
                                      child: const Text('Cancelar'),
                                    ),
                                    FilledButton(
                                      onPressed: () =>
                                          Navigator.pop(context, true),
                                      style: FilledButton.styleFrom(
                                        backgroundColor: AppColors.noApto,
                                      ),
                                      child: const Text('Eliminar'),
                                    ),
                                  ],
                                ),
                              ) ??
                              false;
                        },
                        onDismissed: (_) => _delete(p),
                        child: InkWell(
                          onTap: () => _openForm(edit: p),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              border: Border.all(color: AppColors.ink2),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(children: [
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: AppColors.primaryBg,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: AppColors.primaryBorder,
                                  ),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  p.seat?.toString() ?? '—',
                                  style: AppTheme.inter(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.primaryDark,
                                    tabular: true,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      p.name,
                                      style: AppTheme.inter(
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.ink9,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'DNI ${p.dni}${p.phone != null ? '  ·  ${p.phone}' : ''}',
                                      style: AppTheme.inter(
                                        fontSize: 11.5,
                                        color: AppColors.ink5,
                                        tabular: true,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(
                                Icons.chevron_right,
                                size: 18,
                                color: AppColors.ink4,
                              ),
                            ]),
                          ),
                        ),
                      );
                    },
                  ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _busy ? null : () => _openForm(),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add, size: 18),
        label: Text(
          'Pasajero',
          style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class _PassengerForm extends StatefulWidget {
  final _Passenger? initial;
  const _PassengerForm({this.initial});

  @override
  State<_PassengerForm> createState() => _PassengerFormState();
}

class _PassengerFormState extends State<_PassengerForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _dniCtl;
  late final TextEditingController _nameCtl;
  late final TextEditingController _seatCtl;
  late final TextEditingController _phoneCtl;

  @override
  void initState() {
    super.initState();
    _dniCtl = TextEditingController(text: widget.initial?.dni ?? '');
    _nameCtl = TextEditingController(text: widget.initial?.name ?? '');
    _seatCtl =
        TextEditingController(text: widget.initial?.seat?.toString() ?? '');
    _phoneCtl = TextEditingController(text: widget.initial?.phone ?? '');
  }

  @override
  void dispose() {
    _dniCtl.dispose();
    _nameCtl.dispose();
    _seatCtl.dispose();
    _phoneCtl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.initial != null;
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 22),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: AppColors.ink3,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              Text(
                isEdit ? 'Editar pasajero' : 'Nuevo pasajero',
                style: AppTheme.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _dniCtl,
                keyboardType: TextInputType.number,
                maxLength: 8,
                decoration: _dec('DNI', '8 dígitos').copyWith(counterText: ''),
                validator: (v) {
                  final t = v?.trim() ?? '';
                  if (t.length != 8) return 'Debe tener 8 dígitos';
                  return null;
                },
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _nameCtl,
                decoration: _dec('Nombre completo', 'Apellidos y nombres'),
                validator: (v) =>
                    (v == null || v.trim().length < 2) ? 'Requerido' : null,
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _seatCtl,
                keyboardType: TextInputType.number,
                decoration: _dec('Asiento', 'Ej: 12'),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _phoneCtl,
                keyboardType: TextInputType.phone,
                decoration: _dec('Teléfono (opcional)', 'Ej: 987654321'),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  onPressed: () {
                    if (!_formKey.currentState!.validate()) return;
                    final seatStr = _seatCtl.text.trim();
                    // Shape conforme al backend Track A (Passenger model):
                    // documentNumber / fullName / seatNumber (string) /
                    // phone / documentType (default DNI).
                    Navigator.pop(context, {
                      'documentNumber': _dniCtl.text.trim(),
                      'fullName': _nameCtl.text.trim(),
                      'documentType': 'DNI',
                      if (seatStr.isNotEmpty) 'seatNumber': seatStr,
                      if (_phoneCtl.text.trim().isNotEmpty)
                        'phone': _phoneCtl.text.trim(),
                    });
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.ink9,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: Text(
                    isEdit ? 'Guardar cambios' : 'Agregar pasajero',
                    style: AppTheme.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _dec(String label, String hint) => InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.ink2),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.ink2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.6),
        ),
      );
}

class _Passenger {
  final String id;
  final String dni;
  final String name;
  final int? seat;
  final String? phone;
  const _Passenger({
    required this.id,
    required this.dni,
    required this.name,
    this.seat,
    this.phone,
  });

  factory _Passenger.fromJson(Map<String, dynamic> j) {
    // El backend Track A devuelve documentNumber / fullName / seatNumber.
    // Mantenemos compat con shapes antiguos (dni / name / seat) por si quedan
    // mocks o respuestas legacy.
    final docNumber = (j['documentNumber'] ?? j['dni'] ?? '').toString();
    final name = (j['fullName'] ?? j['name'] ?? j['nombre'] ?? '').toString();
    final rawSeat = j['seatNumber'] ?? j['seat'];
    final seat = rawSeat is num
        ? rawSeat.toInt()
        : int.tryParse((rawSeat ?? '').toString());
    return _Passenger(
      id: (j['id'] ?? j['_id'] ?? '').toString(),
      dni: docNumber,
      name: name,
      seat: seat,
      phone: j['phone'] as String?,
    );
  }
}
