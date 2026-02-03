import { Suspense } from 'react';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

export default function BookingSuccessPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                <div className="mb-6">
                    <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Pagamento Confirmado! ✅
                </h1>

                <p className="text-gray-600 mb-6">
                    Seu agendamento foi confirmado com sucesso.
                    Você receberá uma confirmação no WhatsApp em instantes.
                </p>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-green-800">
                        📱 Fique atento ao seu WhatsApp para mais detalhes sobre seu agendamento.
                    </p>
                </div>

                <Link
                    href="/"
                    className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                    Voltar ao Início
                </Link>
            </div>
        </div>
    );
}
