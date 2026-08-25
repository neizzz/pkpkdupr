import React from "react";
import { PRIVACY_POLICY_EFFECTIVE_DATE } from "@pkpkdupr/shared/privacyPolicy";

interface PrivacyPolicyContentProps {
  className?: string;
}

const PrivacyPolicyContent: React.FC<PrivacyPolicyContentProps> = ({
  className = "",
}) => (
  <div className={`text-sm leading-6 ${className}`}>
      <p className="text-pkpk-sub-font">시행일: {PRIVACY_POLICY_EFFECTIVE_DATE}</p>
      <p className="mt-4">
        PKELO(이하 “서비스”)는 이용자의 개인정보를 중요하게 여기며,
        개인정보 보호법 등 관련 법령을 준수합니다. 본 방침은 서비스가
        처리하는 개인정보의 항목, 목적, 보유 기간 및 이용자의 권리를
        안내합니다.
      </p>

      <section className="mt-8">
        <h2 className="text-base font-bold">1. 처리하는 개인정보</h2>
        <p className="mt-2">
          서비스는 아래 정보를 서비스 제공에 필요한 범위에서 처리합니다.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[420px] border-collapse text-left text-xs leading-5">
            <thead className="bg-pkpk-bg text-pkpk-sub-font">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">구분</th>
                <th scope="col" className="px-3 py-2 font-semibold">처리 항목</th>
                <th scope="col" className="px-3 py-2 font-semibold">처리 목적</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-3 py-2 align-top font-semibold">카카오 로그인</td>
                <td className="px-3 py-2 align-top">카카오 계정 식별자</td>
                <td className="px-3 py-2 align-top">본인 식별 및 로그인 처리</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-2 align-top font-semibold">프로필</td>
                <td className="px-3 py-2 align-top">사용자명, 성별, 생년월일, 프로필 이미지, 소속, 상태 메시지</td>
                <td className="px-3 py-2 align-top">선수 식별, 프로필 및 커뮤니티 기능 제공</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-2 align-top font-semibold">경기 및 클럽 활동</td>
                <td className="px-3 py-2 align-top">경기 참가자, 일정, 장소·코트, 점수·결과·승인 기록, 평점, 클럽·공지·가입 기록</td>
                <td className="px-3 py-2 align-top">경기 기록, 평점 산정, 클럽 운영 및 기록 조회</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-2 align-top font-semibold">서비스 이용</td>
                <td className="px-3 py-2 align-top">로그인 세션 정보 및 기기에 저장되는 인증·프로필 캐시</td>
                <td className="px-3 py-2 align-top">로그인 유지 및 오프라인 상태에서의 화면 제공</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-2 align-top font-semibold">방침 동의</td>
                <td className="px-3 py-2 align-top">동의한 개인정보 처리방침 버전 및 동의 시각</td>
                <td className="px-3 py-2 align-top">방침 동의 여부 확인 및 동의 이력 관리</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-pkpk-sub-font">
          카카오 로그인 과정에서 서비스는 카카오 계정의 식별자만 조회하며,
          카카오 프로필·친구 목록 등은 수집하지 않습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-bold">2. 개인정보의 처리 및 보유 기간</h2>
        <p className="mt-2">
          개인정보는 회원 자격이 유지되는 동안 처리합니다. 다만 경기 결과,
          평점 변동, 클럽 운영 및 관리자 처리 기록은 서비스의 기록 정합성,
          분쟁 대응 및 관련 법령상 의무 이행에 필요한 범위에서 보관할 수
          있습니다. 카카오 로그인 과정의 일회성 인증 정보는 인증 완료 또는
          만료 후 지체 없이 사용할 수 없도록 처리합니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-bold">3. 개인정보의 제3자 제공 및 처리위탁</h2>
        <p className="mt-2">
          서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
          다만 이용자가 카카오 로그인을 선택한 경우 인증을 위해 카카오의
          인증 서비스를 이용합니다. 법령에 특별한 규정이 있거나 이용자의
          별도 동의가 있는 경우에는 해당 법령 또는 동의 범위에 따라 제공할
          수 있습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-bold">4. 개인정보의 이용 및 공개 범위</h2>
        <p className="mt-2">
          사용자명, 성별, 만 나이, 프로필 이미지, 소속, 경기 참가·결과 및 평점은 다른
          서비스 이용자에게 경기 기록, 선수 프로필, 클럽 및 랭킹 화면을
          통해 표시될 수 있습니다. 프로필 이미지, 소속 및 상태 메시지는
          이용자가 직접 수정하거나 삭제할 수 있습니다. 생년월일은 만 나이 계산에만 사용하며,
          프로필에는 생년월일 자체를 표시하지 않습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-bold">5. 이용자의 권리와 행사 방법</h2>
        <p className="mt-2">
          이용자는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지 및
          회원 탈퇴를 요청할 수 있습니다. 프로필 정보는 서비스 내에서 직접
          수정할 수 있으며, 직접 처리할 수 없는 요청은 아래 문의처로
          접수할 수 있습니다. 서비스는 관련 법령이 정한 절차에 따라
          처리합니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-bold">6. 안전성 확보 조치</h2>
        <p className="mt-2">
          서비스는 인증 정보의 안전한 처리, 접근 권한 관리, 전송 구간 보호
          및 접근 기록 관리 등 개인정보 보호를 위한 합리적인 기술적·관리적
          조치를 적용합니다. 이용자는 로그인 토큰이나 계정 접근 정보를
          타인과 공유하지 않아야 합니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-bold">7. 개인정보 보호 문의</h2>
        <p className="mt-2">
          개인정보 처리와 관련한 문의, 불만 처리 및 권리 행사는 아래
          개인정보 보호책임자에게 요청할 수 있습니다.
        </p>
        <dl className="mt-3 rounded-xl bg-pkpk-bg px-4 py-3">
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold">개인정보 보호책임자</dt>
            <dd>최충호 (PKELO 운영자)</dd>
          </div>
          <div className="mt-1 flex gap-2">
            <dt className="shrink-0 font-semibold">이메일</dt>
            <dd>
              <a
                href="mailto:dev.chchh@gmail.com"
                className="text-pkpk-primary-bg underline underline-offset-4"
              >
                dev.chchh@gmail.com
              </a>
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-bold">8. 방침의 변경</h2>
        <p className="mt-2">
          본 방침이 변경되는 경우 시행일과 변경 내용을 서비스 내 공지 또는
          본 페이지를 통해 안내합니다.
        </p>
      </section>
  </div>
);

export default PrivacyPolicyContent;
