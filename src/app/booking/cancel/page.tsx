import Link from 'next/link';
import { XCircle } from 'lucide-react';

export default function BookingCancelPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                <div className="mb-6">
                    <XCircle className="w-20 h-20 text-red-500 mx-auto" />
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Pagamento Cancelado
                </h1>

                <p className="text-gray-600 mb-6">
                    Você cancelou o pagamento. Seu agendamento não foi confirmado.
                </p>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-yellow-800">
                        💬 Se precisar reagendar, basta enviar uma mensagem no WhatsApp novamente!
                    </p>
                </div>

                <Link
                    href="/"
                    className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                >
                    Voltar ao Início
                </Link>
            </div>
        </div>
    );
}
