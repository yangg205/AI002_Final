import 'package:flutter/material.dart';

class AppHeader extends StatelessWidget {
  const AppHeader({super.key, required this.onBellTap});

  final VoidCallback onBellTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 78,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: const BoxDecoration(
        color: Color(0xFFFFFAF1),
        boxShadow: [
          BoxShadow(
            color: Color(0x0A7B6500),
            blurRadius: 8,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: Color(0xFFFFF0B9),
              shape: BoxShape.circle,
            ),
            child: const Text('🌿', style: TextStyle(fontSize: 24)),
          ),
          const Expanded(
            child: Text(
              'JoyfulMind',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: Color(0xFF625300),
              ),
            ),
          ),
          IconButton(
            onPressed: onBellTap,
            icon: const Icon(
              Icons.notifications_none_rounded,
              size: 30,
              color: Color(0xFF625300),
            ),
          ),
        ],
      ),
    );
  }
}
