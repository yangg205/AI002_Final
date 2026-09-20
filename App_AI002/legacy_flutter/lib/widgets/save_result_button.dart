import 'package:flutter/material.dart';

import '../core/app_colors.dart';

class SaveResultButton extends StatelessWidget {
  const SaveResultButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.olive,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(64),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('Lưu Kết Quả'),
          SizedBox(width: 16),
          Icon(Icons.arrow_forward_rounded, size: 30),
        ],
      ),
    );
  }
}
